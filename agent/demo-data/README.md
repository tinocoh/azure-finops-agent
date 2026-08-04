# Sample upload files

These generated files exercise every code path in `QueryUploadedFile`. Drag any of them into the chat to test locally.

> The larger files are git-ignored to keep the sample repository lightweight. Run [generate.py](generate.py) once to materialize them, then the links below open in VS Code.

| File                                                           | Kind          | Size                 | What to ask the AI                                                                                                                          |
| -------------------------------------------------------------- | ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`azure-cost-90days.csv`](azure-cost-90days.csv)               | csv           | ~8.8 MB / 31.5k rows | "Which service drove the most cost? Show me top 5 by `ServiceName`." → forces `aggregate(group_by=ServiceName, agg=sum, column=PreTaxCost)` |
| [`azure-resources.tsv`](azure-resources.tsv)                   | tsv           | ~1.4 MB / 5k rows    | "How many VMs are deallocated and how much do they cost monthly?" → `filter(column=powerState, op=eq, value=deallocated)`                   |
| [`advisor-recommendations.json`](advisor-recommendations.json) | json (array)  | ~390 KB / 500 items  | "Group recommendations by impact and category." → `head` then `aggregate`                                                                   |
| [`cost-export.json`](cost-export.json)                         | json (object) | ~3 KB                | "What's the YoY trend?" → `json_path("tagBreakdown.cost-center")`                                                                           |
| [`finops-notes.md`](finops-notes.md)                           | txt           | ~20 KB               | "Summarize the top 5 findings." → `text_range`                                                                                              |
| [`audit.log`](audit.log)                                       | txt           | ~2.2 MB / 20k lines  | "How many ERROR-level events in the last 7 days?" → `text_range` slices                                                                     |
| [`vm-inventory.xlsx`](vm-inventory.xlsx)                       | xlsx          | ~70 KB / 3 sheets    | "Which sheet has snapshots and what's the total cost?" → `schema` then `aggregate` per sheet                                                |
| [`finops-report.pdf`](finops-report.pdf)                       | pdf           | ~9 KB / 8 pages      | "What's the executive summary?" → `text_range`                                                                                              |
| [`cost-export.parquet`](cost-export.parquet)                   | parquet       | ~1.3 MB / 50k rows   | "Average daily spend per location, top 10." → `aggregate`                                                                                   |

## Regenerate generated files

```pwsh
cd C:\repos\azure-finops-agent
python agent\demo-data\generate.py
```

## Notes

- All data is fake (random + seeded). No real Azure tenant info.
- The 100 MB upload cap is enforced server-side; everything here is well under that.
- Generated large files are git-ignored (see `.gitignore`) — only `generate.py`, this README, and small static samples are tracked.
