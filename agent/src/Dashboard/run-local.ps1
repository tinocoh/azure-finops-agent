<#
.SYNOPSIS
  Arranca el FinOps AI Agent en local (backend + UI web) en http://localhost:5180.

.DESCRIPTION
  Setea las variables de entorno que el proceso necesita y ejecuta el backend .NET, que
  además sirve la UI web (wwwroot). La config de Azure OpenAI y el OAuth (Microsoft:*) se
  leen de .NET user-secrets (ver docs/OAUTH-SETUP.md). Modo SOLO-LECTURA por defecto.

  Requisitos previos (una vez):
    cd cost-mcp; npm ci; npm run build
    cd ../agent/src/Dashboard/webui; npm install; npm run build   # genera ../wwwroot
    cd ..; dotnet build -c Release

.PARAMETER SubscriptionId
  ID de la suscripción de Azure a consultar (Cost Management).

.PARAMETER Url
  URL de escucha (default http://localhost:5180).

.EXAMPLE
  ./run-local.ps1 -SubscriptionId "11803c68-...."
  # luego abre http://localhost:5180 y pulsa "Conectar Azure"
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
else { Write-Warning "cost-mcp no compilado ($costMcp). Las tools de costo no estarán disponibles. Corre 'npm run build' en cost-mcp." }

$dll = Join-Path $here "bin\Release\net10.0\Dashboard.dll"
if (-not (Test-Path $dll)) { throw "No existe $dll. Corre 'dotnet build -c Release' primero." }

Write-Host "FinOps AI Agent escuchando en $Url  (Ctrl+C para detener)" -ForegroundColor Green
dotnet $dll
