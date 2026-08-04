// MCP stdio smoke test — proves azure-cost-mcp speaks the MCP protocol over stdio
// exactly as the FinOps agent will spawn it (SessionConfig.McpServers / McpStdioServerConfig).
// Spawns the built server, performs the MCP handshake, lists tools, and asserts the
// expected 9 tools are present. No Azure auth required (tools/list is unauthenticated).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const EXPECTED = [
  'azure_search_prices',
  'azure_compare_vm_prices',
  'azure_find_cheapest_region',
  'azure_compare_reservation_vs_payg',
  'azure_estimate_architecture_cost',
  'azure_query_costs',
  'azure_query_costs_by_resource',
  'azure_get_cost_forecast',
  'azure_list_budgets',
  'azure_get_advisor_recommendations',
];

const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'] });
const client = new Client({ name: 'cost-mcp-smoke', version: '1.0.0' });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  const missing = EXPECTED.filter((n) => !names.includes(n));

  if (missing.length > 0) {
    console.error(`✗ MCP smoke FAILED — missing tools: ${missing.join(', ')}`);
    console.error(`  got: ${names.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ MCP smoke OK — server exposes all ${EXPECTED.length} expected tools over stdio.`);
  }
} catch (err) {
  console.error('✗ MCP smoke FAILED — could not complete handshake:', err);
  process.exitCode = 1;
} finally {
  await client.close();
}
