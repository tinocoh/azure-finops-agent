"""
file_inspect.py — uploaded-file preview + query helper for the Azure FinOps Agent.

Invocation:
    python3 file_inspect.py
    stdin: JSON request { mode, path, kind, ... }
    stdout: JSON response { ok, ... }   (single line, always JSON)
    stderr: human-readable error (only on hard failure)

Modes:
    preview        Initial inspection — schema + first N rows / chars (used at upload time)
    schema         Re-emit just the schema (cheap)
    head           First N rows / chars
    tail           Last N rows / chars
    slice          Rows offset..offset+count (or text bytes)
    text_range     For txt/pdf — substring(start, length)
    count          Row count (and column count where applicable)
    filter         CSV/JSON-records: rows where col {op} value (op in eq, ne, gt, lt, ge, le, contains)
    aggregate      CSV/JSON-records: group_by + agg(sum|mean|min|max|count) on a numeric column
    json_path      JSON: navigate dot/bracket path, return that subtree (truncated)

All responses cap payload size (rows, characters) so the model never sees more
than a small chunk per call. The model is expected to make multiple calls.
"""
from __future__ import annotations
import io
import json
import math
import os
import sys
import traceback
import warnings
from typing import Any

# stdout MUST be pure JSON — route every warning to stderr so a stray
# pandas/pyarrow DeprecationWarning can't corrupt the response.
warnings.simplefilter("ignore")
warnings.showwarning = lambda *a, **kw: None

# Hard caps — these protect the LLM context window
MAX_ROWS_PER_CALL = 200
MAX_TEXT_CHARS_PER_CALL = 8000
PREVIEW_ROWS = 50
PREVIEW_TEXT_CHARS = 5000
PREVIEW_JSON_ITEMS = 10
SCHEMA_MAX_KEYS = 200
SCHEMA_MAX_DEPTH = 6


def _ok(**payload: Any) -> dict:
    return {"ok": True, **payload}


def _err(message: str, **extra: Any) -> dict:
    return {"ok": False, "error": message, **extra}


def _clean(value: Any) -> Any:
    """Recursively replace NaN/Inf (invalid JSON) with None and downcast numpy scalars."""
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    # numpy / pandas scalars
    try:
        import numpy as _np  # local import to avoid hard dep at module load
        if isinstance(value, _np.generic):
            v = value.item()
            return _clean(v)
    except Exception:
        pass
    return value


# ------------------------------------------------------------------ JSON utils

def _json_schema(value: Any, depth: int = 0) -> Any:
    if depth >= SCHEMA_MAX_DEPTH:
        return "..."
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        if not value:
            return ["empty"]
        # represent as one-element list of the merged item shape
        sample = value[0]
        return [_json_schema(sample, depth + 1)]
    if isinstance(value, dict):
        out = {}
        for i, (k, v) in enumerate(value.items()):
            if i >= SCHEMA_MAX_KEYS:
                out["..."] = f"+{len(value) - SCHEMA_MAX_KEYS} more keys"
                break
            out[k] = _json_schema(v, depth + 1)
        return out
    return type(value).__name__


def _json_path_get(root: Any, path: str) -> Any:
    """Very small dot/bracket navigator: a.b[0].c"""
    if not path:
        return root
    cur = root
    token = ""
    i = 0
    parts: list[str | int] = []
    while i < len(path):
        ch = path[i]
        if ch == ".":
            if token:
                parts.append(token)
                token = ""
            i += 1
        elif ch == "[":
            if token:
                parts.append(token)
                token = ""
            j = path.find("]", i)
            if j < 0:
                raise ValueError(f"unterminated [ at {i}")
            parts.append(int(path[i + 1 : j]))
            i = j + 1
        else:
            token += ch
            i += 1
    if token:
        parts.append(token)
    for p in parts:
        if isinstance(p, int):
            cur = cur[p]
        else:
            cur = cur[p]
    return cur


# --------------------------------------------------------------------- handlers

def _handle_text(req: dict, raw: bytes) -> dict:
    text = raw.decode("utf-8", errors="replace")
    total = len(text)
    mode = req["mode"]
    if mode in ("preview", "head"):
        n = min(int(req.get("chars", PREVIEW_TEXT_CHARS)), MAX_TEXT_CHARS_PER_CALL)
        return _ok(kind="txt", total_chars=total, chunk=text[:n], preview_chars=n)
    if mode == "tail":
        n = min(int(req.get("chars", PREVIEW_TEXT_CHARS)), MAX_TEXT_CHARS_PER_CALL)
        return _ok(kind="txt", total_chars=total, chunk=text[-n:], preview_chars=n)
    if mode == "text_range":
        start = max(0, int(req.get("start", 0)))
        length = min(int(req.get("length", PREVIEW_TEXT_CHARS)), MAX_TEXT_CHARS_PER_CALL)
        return _ok(kind="txt", total_chars=total, chunk=text[start : start + length])
    if mode == "count":
        return _ok(kind="txt", total_chars=total, total_lines=text.count("\n") + 1)
    if mode == "schema":
        return _ok(kind="txt", total_chars=total)
    return _err(f"mode '{mode}' not supported for txt")


def _handle_json(req: dict, raw: bytes) -> dict:
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        return _err(f"invalid JSON: {e}")
    mode = req["mode"]

    if mode in ("preview", "schema"):
        if isinstance(data, list):
            return _ok(
                kind="json",
                shape="array",
                length=len(data),
                schema=_json_schema(data[:1]),
                first_items=data[: PREVIEW_JSON_ITEMS],
            )
        return _ok(
            kind="json",
            shape="object" if isinstance(data, dict) else type(data).__name__,
            schema=_json_schema(data),
            sample=data if not isinstance(data, (list, dict)) else None,
        )

    if mode == "json_path":
        try:
            sub = _json_path_get(data, req.get("path", ""))
        except Exception as e:
            return _err(f"json_path error: {e}")
        # truncate
        if isinstance(sub, list):
            return _ok(kind="json", path=req.get("path", ""), length=len(sub), items=sub[:MAX_ROWS_PER_CALL])
        return _ok(kind="json", path=req.get("path", ""), value=sub if not isinstance(sub, dict) else dict(list(sub.items())[:SCHEMA_MAX_KEYS]))

    if mode in ("head", "tail", "slice"):
        if not isinstance(data, list):
            return _err("head/tail/slice require a JSON array root")
        offset = int(req.get("offset", 0))
        count = min(int(req.get("count", 50)), MAX_ROWS_PER_CALL)
        if mode == "head":
            chunk = data[:count]
        elif mode == "tail":
            chunk = data[-count:]
        else:
            chunk = data[offset : offset + count]
        return _ok(kind="json", length=len(data), offset=offset if mode == "slice" else 0, items=chunk)

    if mode == "count":
        if isinstance(data, list):
            return _ok(kind="json", length=len(data))
        if isinstance(data, dict):
            return _ok(kind="json", keys=len(data))
        return _ok(kind="json", scalar=True)

    if mode in ("filter", "aggregate"):
        # Treat list-of-objects as a tabular dataset and reuse pandas
        if not isinstance(data, list) or not data or not isinstance(data[0], dict):
            return _err("filter/aggregate require a JSON array of objects")
        import pandas as pd
        df = pd.DataFrame(data)
        return _df_query(df, req, kind="json")

    return _err(f"mode '{mode}' not supported for json")


def _df_query(df, req: dict, kind: str) -> dict:
    import pandas as pd  # noqa: F401
    mode = req["mode"]

    if mode == "filter":
        col = req["column"]
        op = req.get("op", "eq")
        val = req.get("value")
        limit = min(int(req.get("limit", 50)), MAX_ROWS_PER_CALL)
        if col not in df.columns:
            return _err(f"unknown column '{col}'", columns=list(df.columns))
        s = df[col]
        try:
            if op == "eq":
                mask = s == val
            elif op == "ne":
                mask = s != val
            elif op == "gt":
                mask = pd.to_numeric(s, errors="coerce") > float(val)
            elif op == "lt":
                mask = pd.to_numeric(s, errors="coerce") < float(val)
            elif op == "ge":
                mask = pd.to_numeric(s, errors="coerce") >= float(val)
            elif op == "le":
                mask = pd.to_numeric(s, errors="coerce") <= float(val)
            elif op == "contains":
                mask = s.astype(str).str.contains(str(val), case=False, na=False)
            else:
                return _err(f"unknown op '{op}'")
        except Exception as e:
            return _err(f"filter failed: {e}")
        sub = df[mask].head(limit)
        return _ok(kind=kind, total_matches=int(mask.sum()), rows=sub.to_dict(orient="records"))

    if mode == "aggregate":
        gb = req.get("group_by")
        agg = req.get("agg", "sum")
        col = req.get("column")
        limit = min(int(req.get("limit", 50)), MAX_ROWS_PER_CALL)
        if col not in df.columns:
            return _err(f"unknown column '{col}'", columns=list(df.columns))
        series = pd.to_numeric(df[col], errors="coerce")
        if gb:
            if gb not in df.columns:
                return _err(f"unknown group_by column '{gb}'", columns=list(df.columns))
            grouped = series.groupby(df[gb])
            result = getattr(grouped, agg)()
            result = result.sort_values(ascending=False).head(limit)
            return _ok(kind=kind, agg=agg, group_by=gb, column=col, rows=[{gb: k, agg: float(v) if pd.notna(v) else None} for k, v in result.items()])
        scalar = getattr(series, agg)()
        return _ok(kind=kind, agg=agg, column=col, value=float(scalar) if pd.notna(scalar) else None)

    return _err(f"mode '{mode}' not supported here")


def _handle_csv(req: dict, raw: bytes) -> dict:
    import pandas as pd
    sep = req.get("sep", ",")
    try:
        df = pd.read_csv(io.BytesIO(raw), sep=sep, low_memory=False)
    except Exception as e:
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python")
        except Exception as e2:
            return _err(f"csv parse failed: {e}; fallback: {e2}")
    return _tabular_response(df, req, kind="csv")


def _handle_xlsx(req: dict, path: str) -> dict:
    import pandas as pd
    sheet = req.get("sheet")
    xl = pd.ExcelFile(path, engine="openpyxl")
    if sheet is None:
        sheet = xl.sheet_names[0]
    if sheet not in xl.sheet_names:
        return _err(f"unknown sheet '{sheet}'", sheets=xl.sheet_names)
    df = xl.parse(sheet)
    payload = _tabular_response(df, req, kind="xlsx")
    if isinstance(payload, dict) and payload.get("ok"):
        payload["sheet"] = sheet
        payload["sheets"] = xl.sheet_names
    return payload


def _handle_parquet(req: dict, path: str) -> dict:
    import pandas as pd
    df = pd.read_parquet(path)
    return _tabular_response(df, req, kind="parquet")


def _tabular_response(df, req: dict, kind: str) -> dict:
    mode = req["mode"]
    cols = list(df.columns)
    dtypes = {c: str(df[c].dtype) for c in cols}

    if mode in ("preview",):
        head_n = min(int(req.get("rows", PREVIEW_ROWS)), MAX_ROWS_PER_CALL)
        return _ok(
            kind=kind,
            total_rows=int(len(df)),
            total_columns=len(cols),
            columns=cols,
            dtypes=dtypes,
            rows=df.head(head_n).to_dict(orient="records"),
            preview_rows=head_n,
        )
    if mode == "schema":
        return _ok(kind=kind, total_rows=int(len(df)), total_columns=len(cols), columns=cols, dtypes=dtypes)
    if mode == "count":
        return _ok(kind=kind, total_rows=int(len(df)), total_columns=len(cols))
    if mode == "head":
        n = min(int(req.get("count", PREVIEW_ROWS)), MAX_ROWS_PER_CALL)
        return _ok(kind=kind, rows=df.head(n).to_dict(orient="records"))
    if mode == "tail":
        n = min(int(req.get("count", PREVIEW_ROWS)), MAX_ROWS_PER_CALL)
        return _ok(kind=kind, rows=df.tail(n).to_dict(orient="records"))
    if mode == "slice":
        offset = max(0, int(req.get("offset", 0)))
        count = min(int(req.get("count", PREVIEW_ROWS)), MAX_ROWS_PER_CALL)
        return _ok(kind=kind, offset=offset, rows=df.iloc[offset : offset + count].to_dict(orient="records"))
    if mode in ("filter", "aggregate"):
        return _df_query(df, req, kind=kind)
    return _err(f"mode '{mode}' not supported for {kind}")


def _handle_pdf(req: dict, path: str) -> dict:
    try:
        from pdfminer.high_level import extract_text
    except Exception as e:
        return _err(f"pdfminer not available: {e}")
    text = extract_text(path) or ""
    # piggyback on text handler semantics
    raw = text.encode("utf-8")
    return _handle_text(req, raw) | {"kind": "pdf"}


# ------------------------------------------------------------------------ main

def main() -> int:
    try:
        req = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as e:
        print(json.dumps(_err(f"bad request json: {e}")))
        return 0

    path = req.get("path")
    kind = (req.get("kind") or "").lower()
    if not path or not os.path.exists(path):
        print(json.dumps(_err("file not found", path=path)))
        return 0

    try:
        if kind in ("xlsx", "xls"):
            resp = _handle_xlsx(req, path)
        elif kind == "parquet":
            resp = _handle_parquet(req, path)
        elif kind == "pdf":
            resp = _handle_pdf(req, path)
        else:
            with open(path, "rb") as f:
                raw = f.read()
            if kind == "csv" or kind == "tsv":
                if kind == "tsv":
                    req.setdefault("sep", "\t")
                resp = _handle_csv(req, raw)
            elif kind == "json":
                resp = _handle_json(req, raw)
            else:  # txt and unknown → text fallback
                resp = _handle_text(req, raw)
    except Exception as e:
        resp = _err(f"{type(e).__name__}: {e}", trace=traceback.format_exc().splitlines()[-5:])

    # Hard cap stdout size — keep the LLM context small
    try:
        out = json.dumps(_clean(resp), default=str, allow_nan=False)
    except (ValueError, TypeError) as e:
        out = json.dumps({"ok": False, "error": f"json serialize failed: {e}"})
    if len(out) > 64_000:
        out = json.dumps({"ok": False, "error": "response too large; narrow your query (use head/slice with smaller count, or filter/aggregate)", "size": len(out)})
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
