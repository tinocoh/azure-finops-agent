// ============================================================================
//  Concrete instantiation of main.bicep used by PSRule so it can analyze the
//  actual resource properties produced by the template. Not deployed directly.
// ============================================================================

targetScope = 'subscription'

module main 'main.bicep' = {
  name: 'main-test'
  params: {
    environmentName: 'psrule-test'
    location: 'eastus2'
    principalId: '00000000-0000-0000-0000-000000000000'
    enablePrivateNetworking: true
    finopsReadOnly: true
  }
}
