param name string
param location string = resourceGroup().location
param tags object = {}

@description('ID do tenant do Azure AD')
param tenantId string = tenant().tenantId

@description('IDs dos objetos que terão acesso ao Key Vault')
param accessPolicies array = []

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenantId
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    enableRbacAuthorization: false
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    accessPolicies: [for policy in accessPolicies: {
      tenantId: tenantId
      objectId: policy.objectId
      permissions: {
        keys: contains(policy, 'keys') ? policy.keys : []
        secrets: contains(policy, 'secrets') ? policy.secrets : [
          'get'
          'list'
        ]
        certificates: contains(policy, 'certificates') ? policy.certificates : []
      }
    }]
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output keyVaultId string = keyVault.id
