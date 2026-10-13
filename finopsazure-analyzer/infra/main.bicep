// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ============================================================================
//  FinOpsAzure Analyzer — infrastructure (Azure Container Apps)
//  Deploys: VNet, Log Analytics, App Insights, ACR, Key Vault,
//  User-Assigned Managed Identity, Container Apps Environment + 2 apps,
//  and Azure OpenAI with a configurable model deployment.
//
//  The resource group (FinOpsAzure) is created with scripts/bootstrap-azure.sh
//  because this template runs at resource-group scope.
//  Validate: az bicep build --file infra/main.bicep
// ============================================================================

@description('Deployment region.')
param location string = resourceGroup().location

@description('Name prefix using lowercase letters and numbers.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'finopsazure'

@description('Globally unique Azure Container Registry name without hyphens.')
param acrName string = toLower('${namePrefix}acr${uniqueString(resourceGroup().id)}')

@description('Azure OpenAI / AI Foundry resource name.')
param aiResourceName string = '${namePrefix}-aoai-${uniqueString(resourceGroup().id)}'

@description('Model deployment name.')
param modelDeploymentName string = 'gpt-4o-mini'

@description('Model to deploy. If it is not available in the region, change it here.')
param modelName string = 'gpt-4o-mini'

@description('Model version.')
param modelVersion string = '2024-07-18'

@description('Model deployment capacity in thousands of TPM.')
param modelCapacity int = 20

@description('Azure OpenAI API version used by the backend.')
param openAiApiVersion string = '2024-10-21'

@description('Backend image, either ACR or an MCR placeholder for the first deployment.')
param backendImage string = 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'

@description('Frontend image, either ACR or an MCR placeholder for the first deployment.')
param frontendImage string = 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'

@description('External backend ingress for testing (true) or internal ingress (false).')
param backendExternalIngress bool = true

@description('Fernet key for encrypting secrets at rest. Delivered as a secure Container App secret encrypted by the platform. Generate with Fernet.generate_key().')
@secure()
param finopsEncryptionKey string

var tags = { app: 'FinOpsAzureAnalyzer', env: 'pilot' }
var vnetName = 'vnet-finopsazure'
var lawName = '${namePrefix}-law'
var aiInsightsName = '${namePrefix}-appi'
var kvName = take('${namePrefix}kv${uniqueString(resourceGroup().id)}', 24)
var uamiName = '${namePrefix}-uami'
var envName = '${namePrefix}-cae'
var backendAppName = '${namePrefix}-backend'
var frontendAppName = '${namePrefix}-frontend'

// Built-in role definition IDs.
var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var kvSecretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
var cognitiveUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')

// ---------------------------------------------------------------------------
// Networking — VNet with a dedicated subnet for the Container Apps Environment
// ---------------------------------------------------------------------------
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.30.0.0/16'] }
    subnets: [
      {
        name: 'containerapps'
        properties: {
          addressPrefix: '10.30.0.0/23'
          delegations: [
            {
              name: 'aca-delegation'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
    ]
  }
}

resource acaSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: 'containerapps'
}

// ---------------------------------------------------------------------------
// Observabilidad
// ---------------------------------------------------------------------------
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: aiInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
  }
}

// ---------------------------------------------------------------------------
// User-Assigned Managed Identity shared by the Container Apps
// ---------------------------------------------------------------------------
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
  tags: tags
}

// ---------------------------------------------------------------------------
// Azure Container Registry
// ---------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// The UAMI can pull from ACR.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, uami.id, acrPullRole)
  properties: {
    roleDefinitionId: acrPullRole
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Key Vault (RBAC) — the app references secrets through Managed Identity
// ---------------------------------------------------------------------------
resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: kvName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
    networkAcls: { defaultAction: 'Allow', bypass: 'AzureServices' }
  }
}

resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, uami.id, kvSecretsUserRole)
  properties: {
    roleDefinitionId: kvSecretsUserRole
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Azure OpenAI / AI Foundry
// ---------------------------------------------------------------------------
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: aiResourceName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: aiResourceName
    publicNetworkAccess: 'Enabled'
  }
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: modelDeploymentName
  sku: { name: 'GlobalStandard', capacity: modelCapacity }
  properties: {
    model: { format: 'OpenAI', name: modelName, version: modelVersion }
  }
}

// The UAMI can invoke the model with RBAC instead of an API key.
resource cognitiveUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openAi
  name: guid(openAi.id, uami.id, cognitiveUserRole)
  properties: {
    roleDefinitionId: cognitiveUserRole
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Container Apps Environment integrated with the VNet
// ---------------------------------------------------------------------------
resource caeEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: acaSubnet.id
      internal: false
    }
  }
}

// ---------------------------------------------------------------------------
// Backend Container App
// ---------------------------------------------------------------------------
resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  properties: {
    managedEnvironmentId: caeEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: backendExternalIngress
        targetPort: 8000
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: uami.id
        }
      ]
      // Encryption key as a platform secret encrypted by Container Apps.
      // Key Vault is provisioned so this secret can be migrated to a Key Vault reference in production.
      secrets: [
        {
          name: 'finops-encryption-key'
          value: finopsEncryptionKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'APP_ENV', value: 'azure' }
            { name: 'DATABASE_URL', value: 'sqlite:///./data/finopsazure.db' }
            { name: 'FINOPS_CONFIG_ENCRYPTION_KEY', secretRef: 'finops-encryption-key' }
            { name: 'AZURE_OPENAI_ENDPOINT', value: 'https://${aiResourceName}.openai.azure.com/' }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: modelDeploymentName }
            { name: 'AZURE_OPENAI_API_VERSION', value: openAiApiVersion }
            { name: 'KEY_VAULT_URI', value: keyVault.properties.vaultUri }
            { name: 'AZURE_CLIENT_ID', value: uami.properties.clientId }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'CORS_ALLOWED_ORIGINS', value: 'https://${frontendAppName}.${caeEnv.properties.defaultDomain}' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
  dependsOn: [acrPull, kvSecretsUser]
}

// ---------------------------------------------------------------------------
// Frontend Container App (ingress externo)
// ---------------------------------------------------------------------------
resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: frontendAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  properties: {
    managedEnvironmentId: caeEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: uami.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            // nginx proxea /api al backend interno del environment.
            { name: 'BACKEND_URL', value: 'https://${backendAppName}.${caeEnv.properties.defaultDomain}' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
  dependsOn: [acrPull]
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output backendAppName string = backendApp.name
output frontendAppName string = frontendApp.name
output backendFqdn string = backendApp.properties.configuration.ingress.fqdn
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn
output azureOpenAiEndpoint string = 'https://${aiResourceName}.openai.azure.com/'
output keyVaultUri string = keyVault.properties.vaultUri
output keyVaultName string = keyVault.name
output managedIdentityClientId string = uami.properties.clientId
output managedIdentityPrincipalId string = uami.properties.principalId
