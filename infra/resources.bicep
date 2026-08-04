// ============================================================================
//  azure-finops-agent — resource-group scoped resources
//
//  Networking, observability, Azure OpenAI, Key Vault and the App Service that
//  hosts the agent. All service-to-service authentication is keyless and uses
//  the site's managed identity.
// ============================================================================

@description('Location for all resources in this resource group.')
param location string

@description('Tags applied to every resource, including the azd environment tag.')
param tags object

@description('Deterministic token used to build globally unique resource names.')
param resourceToken string

@description('Object ID of the user or service principal running the deployment.')
param principalId string

@description('Location for the Azure OpenAI account.')
param openAiLocation string

@description('Name of the Azure OpenAI model deployment.')
param openAiDeploymentName string

@description('Azure OpenAI model to deploy.')
param openAiModelName string

@description('Azure OpenAI model version to deploy.')
param openAiModelVersion string

@description('Provisioned throughput for the Azure OpenAI deployment.')
param openAiCapacity int

@description('SKU of the App Service plan hosting the agent.')
param appServicePlanSku string

@description('Disable public network access and reach Azure OpenAI and Key Vault over private endpoints only.')
param enablePrivateNetworking bool

@description('Run the agent in read-only mode.')
param finopsReadOnly bool

@description('Entra application (client) ID used for user sign-in.')
param microsoftClientId string

var abbrs = loadJsonContent('abbreviations.json')

var openAiName = '${abbrs.cognitiveServicesAccounts}${resourceToken}'
var keyVaultName = take('${abbrs.keyVaultVaults}${resourceToken}', 24)
var siteName = '${abbrs.webSites}${resourceToken}'

// Built-in role definition GUIDs.
var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var cognitiveServicesOpenAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${abbrs.insightsComponents}${resourceToken}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Networking. The virtual network is always created so the app runs with
// outbound VNet integration; private endpoints are added only for the
// audit-safe posture.
// ---------------------------------------------------------------------------
resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${abbrs.networkVirtualNetworks}${resourceToken}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'app'
        properties: {
          addressPrefix: '10.20.1.0/24'
          delegations: [
            {
              name: 'webapp'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
          privateEndpointNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'privateendpoints'
        properties: {
          addressPrefix: '10.20.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource appSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: virtualNetwork
  name: 'app'
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: virtualNetwork
  name: 'privateendpoints'
}

// ---------------------------------------------------------------------------
// Azure OpenAI. Local (key) authentication is always disabled; callers use
// Entra tokens through managed identity.
// ---------------------------------------------------------------------------
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiName
  location: openAiLocation
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: openAiName
    publicNetworkAccess: enablePrivateNetworking ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: enablePrivateNetworking ? 'Deny' : 'Allow'
    }
    disableLocalAuth: true
  }
}

resource openAiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: openAiDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: openAiCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: openAiModelName
      version: openAiModelVersion
    }
  }
}

// ---------------------------------------------------------------------------
// Key Vault. RBAC only, no access policies, soft delete and purge protection
// enabled as required for regulated workloads.
// ---------------------------------------------------------------------------
resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: enablePrivateNetworking ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: enablePrivateNetworking ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ---------------------------------------------------------------------------
// Private endpoints, only for the audit-safe posture.
// ---------------------------------------------------------------------------
module openAiPrivateEndpoint 'modules/private-endpoint.bicep' = if (enablePrivateNetworking) {
  name: 'pe-openai'
  params: {
    location: location
    peName: '${abbrs.networkPrivateEndpoints}${openAiName}'
    subnetId: privateEndpointSubnet.id
    vnetId: virtualNetwork.id
    privateLinkServiceId: openAi.id
    groupId: 'account'
    dnsZoneName: 'privatelink.openai.azure.com'
  }
}

module keyVaultPrivateEndpoint 'modules/private-endpoint.bicep' = if (enablePrivateNetworking) {
  name: 'pe-keyvault'
  params: {
    location: location
    peName: '${abbrs.networkPrivateEndpoints}${keyVaultName}'
    subnetId: privateEndpointSubnet.id
    vnetId: virtualNetwork.id
    privateLinkServiceId: keyVault.id
    groupId: 'vault'
    dnsZoneName: 'privatelink.vaultcore.azure.net'
  }
}

// ---------------------------------------------------------------------------
// App Service hosting the agent. The azd-service-name tag maps this site to
// the "agent" service declared in azure.yaml.
// ---------------------------------------------------------------------------
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${abbrs.webServerFarms}${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource agentSite 'Microsoft.Web/sites@2024-04-01' = {
  name: siteName
  location: location
  tags: union(tags, {
    'azd-service-name': 'agent'
  })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    virtualNetworkSubnetId: appSubnet.id
    vnetRouteAllEnabled: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'AzureOpenAI__Endpoint'
          value: 'https://${openAiName}.openai.azure.com/'
        }
        {
          name: 'AzureOpenAI__DeploymentName'
          value: openAiDeploymentName
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'AZURE_KEY_VAULT_NAME'
          value: keyVaultName
        }
        {
          name: 'COST_MCP_PATH'
          value: '/home/site/wwwroot/cost-mcp/dist/index.js'
        }
        {
          name: 'FINOPS_READONLY'
          value: string(finopsReadOnly)
        }
        {
          name: 'AUDIT_LOG_PATH'
          value: '/home/audit/finops-audit.log'
        }
        {
          name: 'Microsoft__ClientId'
          value: microsoftClientId
        }
        {
          name: 'Microsoft__TenantId'
          value: tenant().tenantId
        }
        {
          name: 'Microsoft__HomeTenantId'
          value: tenant().tenantId
        }
        {
          name: 'WEBSITE_DNS_SERVER'
          value: '168.63.129.16'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Role assignments. The site's managed identity gets exactly the read access
// it needs; the deploying user gets the same OpenAI access for local runs.
// ---------------------------------------------------------------------------
module agentOpenAiRole 'core/security/role.bicep' = {
  name: 'agent-openai-role'
  params: {
    principalId: agentSite.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesOpenAiUserRoleId
  }
}

module agentCognitiveServicesRole 'core/security/role.bicep' = {
  name: 'agent-cognitiveservices-role'
  params: {
    principalId: agentSite.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesUserRoleId
  }
}

module agentKeyVaultRole 'core/security/role.bicep' = {
  name: 'agent-keyvault-role'
  params: {
    principalId: agentSite.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

module userOpenAiRole 'core/security/role.bicep' = if (!empty(principalId)) {
  name: 'user-openai-role'
  params: {
    principalId: principalId
    principalType: 'User'
    roleDefinitionId: cognitiveServicesOpenAiUserRoleId
  }
}

output openAiEndpoint string = 'https://${openAiName}.openai.azure.com/'
output openAiDeploymentName string = openAiDeployment.name
output keyVaultName string = keyVault.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
output agentSiteName string = agentSite.name
output agentSiteUri string = 'https://${agentSite.properties.defaultHostName}'
output agentPrincipalId string = agentSite.identity.principalId
