// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// Reusable Private Endpoint, Private DNS zone, zone group, and VNet link.
@description('Region.')
param location string

@description('Private endpoint name.')
param peName string

@description('Subnet where the private endpoint will be created.')
param subnetId string

@description('VNet to link with the private DNS zone.')
param vnetId string

@description('Resource ID of the service, such as OpenAI or Key Vault.')
param privateLinkServiceId string

@description('Service groupId, such as account for OpenAI or vault for Key Vault.')
param groupId string

@description('Private DNS zone name, such as privatelink.openai.azure.com.')
param dnsZoneName string

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: peName
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [
      {
        name: peName
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: [groupId]
        }
      }
    ]
  }
}

resource dnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: dnsZoneName
  location: 'global'
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsZone
  name: '${peName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnetId }
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: { privateDnsZoneId: dnsZone.id }
      }
    ]
  }
}

output privateEndpointId string = privateEndpoint.id
