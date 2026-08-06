# Azure FinOps Agent web UI

React + TypeScript + Fluent UI chat interface for the Azure FinOps Agent.

## Stack

- Vite
- React
- TypeScript
- Fluent UI v9

The build output is written to `../wwwroot` so the .NET `Dashboard` application can serve the
single-page app with `UseStaticFiles` and `MapFallbackToFile`.

## Features

- Azure connection status and sign-in entry point.
- Streaming chat over `/api/chat`.
- Tool-call progress indicators.
- Markdown rendering for agent responses.
- Chart rendering for JSON chart payloads.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

`wwwroot/` is generated output and is intentionally ignored by git.
