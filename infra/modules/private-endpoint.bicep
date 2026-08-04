// Private Endpoint + Private DNS zone + zone group + VNet link (reutilizable).
@description('Región.')
param location string

@description('Nombre del private endpoint.')
param peName string

@description('Subred donde crear el PE.')
param subnetId string

@description('VNet a enlazar con la zona DNS privada.')
param vnetId string

@description('Resource ID del servicio (OpenAI, Key Vault, ...).')
param privateLinkServiceId string

@description('groupId del servicio (p.ej. account para OpenAI, vault para Key Vault).')
param groupId string

@description('Nombre de la zona DNS privada (p.ej. privatelink.openai.azure.com).')
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
