<#
.SYNOPSIS
  Starts the FinOps AI Agent locally (backend + web UI) at http://localhost:5180.

.DESCRIPTION
  Sets the environment variables required by the process and runs the .NET backend,
  which also serves the web UI (wwwroot). Azure OpenAI and OAuth (Microsoft:*) config
  are read from .NET user-secrets (see docs/OAUTH-SETUP.md). Read-only mode is enabled
  by default.

  One-time prerequisites:
    cd cost-mcp; npm ci; npm run build
    cd ../agent/src/Dashboard/webui; npm ci; npm run build   # generates ../wwwroot
    cd ..; dotnet build -c Release

.PARAMETER SubscriptionId
  Azure subscription ID to query through Cost Management.

.PARAMETER Url
  Listen URL (default http://localhost:5180).

.EXAMPLE
  ./run-local.ps1 -SubscriptionId "11803c68-...."
  # then open http://localhost:5180 and select "Connect Azure"
#>
param(
  [Parameter(Mandatory = $true)][string]$SubscriptionId,
  [string]$Url = "http://localhost:5180"
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ASPNETCORE_URLS        = $Url
$env:AZURE_SUBSCRIPTION_ID  = $SubscriptionId
$env:FINOPS_READONLY        = "true"
$env:AUDIT_LOG_PATH         = Join-Path $env:USERPROFILE "finops-audit.log"

$costMcp = Join-Path $here "..\..\..\cost-mcp\dist\index.js"
if (Test-Path $costMcp) { $env:COST_MCP_PATH = (Resolve-Path $costMcp).Path }
else { Write-Warning "cost-mcp is not built ($costMcp). Cost tools will not be available. Run 'npm run build' in cost-mcp." }

$dll = Join-Path $here "bin\Release\net10.0\Dashboard.dll"
if (-not (Test-Path $dll)) { throw "$dll does not exist. Run 'dotnet build -c Release' first." }

Write-Host "FinOps AI Agent listening at $Url  (Ctrl+C to stop)" -ForegroundColor Green
dotnet $dll
