#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/env.js';
import { register as registerSearchPrices } from './tools/retail/search-prices.tool.js';
import { register as registerCompareVm } from './tools/retail/compare-vm-prices.tool.js';
import { register as registerCheapestRegion } from './tools/retail/find-cheapest-region.tool.js';
import { register as registerReservation } from './tools/retail/compare-reservation.tool.js';
import { register as registerEstimate } from './tools/retail/estimate-architecture.tool.js';
import { register as registerQueryCosts } from './tools/cost-management/query-costs.tool.js';
import { register as registerQueryByResource } from './tools/cost-management/query-costs-by-resource.tool.js';
import { register as registerForecast } from './tools/cost-management/get-forecast.tool.js';
import { register as registerBudgets } from './tools/cost-management/list-budgets.tool.js';
import { register as registerAdvisor } from './tools/advisor/get-recommendations.tool.js';

const config = loadConfig();

const server = new McpServer({ name: 'azure-cost-mcp', version: '0.1.0' });

// Retail tools (no auth required)
registerSearchPrices(server);
registerCompareVm(server);
registerCheapestRegion(server);
registerReservation(server);
registerEstimate(server);

// Cost Management tools (auth required — pass config so tools can return setup instructions when null)
registerQueryCosts(server, config.costManagement);
registerQueryByResource(server, config.costManagement);
registerForecast(server, config.costManagement);
registerBudgets(server, config.costManagement);
registerAdvisor(server, config.costManagement);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('azure-cost-mcp running via stdio');
