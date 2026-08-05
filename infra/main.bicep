// ============================================================================
//  azure-finops-agent — main deployment
//
//  Provisions the FinOps agent on Azure App Service with keyless access to
//  Azure OpenAI, an optional fully private networking posture for regulated
//  tenants, and OpenTelemetry export to Application Insights.
//
//  Deploy with:   azd up
//  Validate with: az bicep build --file infra/main.bicep
// ============================================================================

targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources.')
@metadata({
  azd: {
    type: 'location'
  }
})
param location string

@description('Name of the resource group. Defaults to rg-{environmentName}.')
param resourceGroupName string = ''

@description('Object ID of the user or service principal running the deployment. Granted data-plane access for local development.')
param principalId string = ''

@description('Location for the Azure OpenAI account. Defaults to the primary location.')
param openAiLocation string = ''

@description('Name of the Azure OpenAI model deployment.')
param openAiDeploymentName string = 'gpt-4.1-mini'

@description('Azure OpenAI model to deploy.')
param openAiModelName string = 'gpt-4.1-mini'

@description('Azure OpenAI model version to deploy.')
param openAiModelVersion string = '2025-04-14'

@minValue(1)
@description('Provisioned throughput for the Azure OpenAI deployment, in thousands of tokens per minute.')
param openAiCapacity int = 50

@description('SKU of the App Service plan hosting the agent.')
param appServicePlanSku string = 'P0v3'

@description('Deploy the audit-safe posture: private endpoints only, public network access disabled on Azure OpenAI and Key Vault. Requires connectivity into the virtual network to reach the app.')
param enablePrivateNetworking bool = false

@description('Deploy the App Service that hosts the agent. Keep true for normal deployments; set false only for quota-limited infrastructure validation.')
param deployAgentService bool = true

@description('Run the agent in read-only mode. Keep true for audit-safe deployments.')
param finopsReadOnly bool = true

@description('Entra application (client) ID used for user sign-in. Empty disables interactive sign-in.')
param microsoftClientId string = ''

var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    principalId: principalId
    openAiLocation: !empty(openAiLocation) ? openAiLocation : location
    openAiDeploymentName: openAiDeploymentName
    openAiModelName: openAiModelName
    openAiModelVersion: openAiModelVersion
    openAiCapacity: openAiCapacity
    appServicePlanSku: appServicePlanSku
    enablePrivateNetworking: enablePrivateNetworking
    deployAgentService: deployAgentService
    finopsReadOnly: finopsReadOnly
    microsoftClientId: microsoftClientId
  }
}

// Consumed by azd and by the application at runtime.
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_OPENAI_ENDPOINT string = resources.outputs.openAiEndpoint
output AZURE_OPENAI_DEPLOYMENT_NAME string = openAiDeploymentName
output AZURE_KEY_VAULT_NAME string = resources.outputs.keyVaultName
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.applicationInsightsConnectionString
output SERVICE_AGENT_NAME string = resources.outputs.agentSiteName
output SERVICE_AGENT_URI string = resources.outputs.agentSiteUri
