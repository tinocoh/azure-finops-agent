"""
Smoke test for the file-upload + QueryUploadedFile pipeline.

Logs in via the dev anonymous-session cookie, uploads every sample, and exercises
each mode of QueryUploadedFile by calling the chat endpoint with prompts that
force specific tool calls. Reports OK / FAIL per file.

Run while the backend is up at http://localhost:5000:
    .\.venv\Scripts\python.exe demo-data\smoke_test.py
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path
import requests

BASE = "http://localhost:5000"
SAMPLES = Path(__file__).parent

FILES = [
    "azure-cost-90days.csv",
    "azure-resources.tsv",
    "advisor-recommendations.json",
    "cost-export.json",
    "finops-notes.md",
    "audit.log",
    "vm-inventory.xlsx",
    "finops-report.pdf",
    "cost-export.parquet",
]


def main():
    s = requests.Session()
    # Trigger a session by hitting any endpoint that issues the cookie
    r = s.get(f"{BASE}/api/version", timeout=5)
    print(f"version: {r.status_code} {r.text[:80]}")

    # Anonymous-session: chat creates the user. Hit /api/chat/reset to provoke the user object.
    # Simpler: the /api/upload endpoint requires session.GetString('user') — confirm anon works.
    # Issue a tiny chat to bootstrap user:
    boot = s.post(f"{BASE}/api/chat", json={"prompt": "hi", "model": ""}, timeout=30, stream=True)
    # Drain a bit so the user gets created.
    for chunk in boot.iter_lines():
        if chunk and chunk.startswith(b"data:"):
            line = chunk.decode("utf-8", "ignore")
            if "[DONE]" in line:
                break
    boot.close()

    print("\n── Uploads ──")
    file_results = []
    for name in FILES:
        path = SAMPLES / name
        if not path.exists():
            print(f"  SKIP   {name} (missing — run generate.py first)")
            continue
        with path.open("rb") as f:
            r = s.post(f"{BASE}/api/upload", files={"file": (name, f)}, timeout=60)
        if r.status_code != 200:
            print(f"  FAIL   {name}  HTTP {r.status_code}: {r.text[:200]}")
            continue
        body = r.json()
        first = body.get("files", [{}])[0]
        if not first.get("ok"):
            print(f"  FAIL   {name}  {first.get('error')}")
            continue
        fid = first["fileId"]
        kind = first["kind"]
        size = first["sizeBytes"]
        preview = first.get("preview", {})
        # Brief preview signature
        if kind in ("csv", "tsv", "xlsx", "parquet"):
            sig = f"rows={preview.get('total_rows')} cols={preview.get('total_columns')}"
        elif kind == "json":
            sig = f"shape={preview.get('shape')} length={preview.get('length','-')}"
        elif kind == "pdf":
            sig = f"chars={preview.get('total_chars')}"
        else:
            sig = f"chars={preview.get('total_chars')}"
        print(f"  OK     {name:34} fileId={fid}  kind={kind:8} size={size:>9}  {sig}")
        file_results.append((name, fid, kind))

    print("\n── QueryUploadedFile direct tests ──")
    # We can also sanity-check QueryUploadedFile by re-uploading and listing
    r = s.get(f"{BASE}/api/uploads")
    listed = r.json().get("files", [])
    print(f"  listed: {len(listed)} file(s) in session")

    # Now trigger the AI to use QueryUploadedFile against the CSV — the most likely-to-be-asked one.
    if file_results:
        prompt = ("Without using any Azure tools, use QueryUploadedFile to: "
                  "(a) read the schema of the CSV I uploaded, "
                  "(b) aggregate sum of PreTaxCost grouped by ServiceName top 5, "
                  "and reply with just the JSON tool result text.")
        print(f"\n── Streaming chat with prompt → '{prompt[:60]}...' ──")
        r = s.post(f"{BASE}/api/chat", json={"prompt": prompt, "model": ""}, timeout=180, stream=True)
        tools_used = []
        deltas = []
        for raw in r.iter_lines():
            if not raw or not raw.startswith(b"data:"):
                continue
            payload = raw[5:].strip()
            if payload == b"[DONE]":
                break
            try:
                evt = json.loads(payload)
            except Exception:
                continue
            t = evt.get("type")
            if t == "tool_start":
                tools_used.append(evt.get("tool"))
                print(f"    tool_start: {evt.get('tool')}  args={str(evt.get('args'))[:120]}")
            elif t == "tool_done":
                ok = evt.get("success")
                dur = evt.get("durationMs")
                print(f"    tool_done : {evt.get('tool')}  ok={ok}  dur={dur}ms")
            elif t == "delta":
                deltas.append(evt.get("content", ""))
            elif t == "error":
                print(f"    error    : {evt.get('message')}")
        r.close()
        text = "".join(deltas)
        print(f"\n  AI reply chars: {len(text)}")
        print(f"  AI reply head : {text[:400]}")
        print(f"  tools used    : {tools_used}")

    # Cleanup
    print("\n── Cleanup ──")
    for name, fid, _ in file_results:
        rd = s.delete(f"{BASE}/api/uploads/{fid}")
        print(f"  delete {fid} ({name}): {rd.status_code}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
