// Manual e2e against a REAL subscription (needs creds — not run in CI).
// Spawns the built MCP server with an injected delegated ARM token (AZURE_ACCESS_TOKEN)
// and calls azure_query_costs for the current month, proving the full
// delegated-token → MCP stdio → Azure Cost Management path end-to-end.
//
// Usage (PowerShell):
//   $env:AZURE_ACCESS_TOKEN = Get-Content $env:TEMP\arm.token -Raw
//   $env:AZURE_SUBSCRIPTION_ID = "<sub-id>"
//   node scripts/mcp-e2e.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: { ...process.env },
});
const client = new Client({ name: 'cost-mcp-e2e', version: '1.0.0' });

try {
  await client.connect(transport);
  const res = await client.callTool({
    name: 'azure_query_costs',
    arguments: {
      timeframe: 'MonthToDate',
      granularity: 'None',
      groupBy: ['ServiceName'],
      response_format: 'markdown',
    },
  });
  const text = (res.content ?? []).map((c) => c.text ?? '').join('\n');
  console.log('--- azure_query_costs (MonthToDate, by ServiceName) ---');
  console.log(text.slice(0, 2000));
  console.log('--- e2e OK: real Cost Management data returned via MCP ---');
} catch (err) {
  console.error('e2e FAILED:', err);
  process.exitCode = 1;
} finally {
  await client.close();
}
