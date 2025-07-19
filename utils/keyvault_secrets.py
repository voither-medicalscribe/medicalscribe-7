import os
import logging
from azure.keyvault.secrets import SecretClient
from azure.identity import ManagedIdentityCredential
from azure.core.exceptions import ResourceNotFoundError

logger = logging.getLogger(__name__)

class KeyVaultSecrets:
    """Gerenciador seguro de segredos usando Azure Key Vault"""
    
    def __init__(self):
        keyvault_url = os.environ.get("AZURE_KEYVAULT_URL", "https://medscriber.vault.azure.net/")
        
        # Usar Managed Identity em produção
        client_id = "e6b960d0-6f3c-4d3a-88f5-03994a3227d3"
        credential = ManagedIdentityCredential(client_id=client_id)
        
        self.client = SecretClient(
            vault_url=keyvault_url,
            credential=credential
        )
        self._cache = {}
        
    def _get_secret(self, secret_name: str) -> str:
        """Busca um segredo do Key Vault com cache"""
        if secret_name in self._cache:
            return self._cache[secret_name]
            
        try:
            secret = self.client.get_secret(secret_name)
            self._cache[secret_name] = secret.value
            return secret.value
        except ResourceNotFoundError:
            logger.error(f"Segredo '{secret_name}' não encontrado no Key Vault")
            raise
        except Exception as e:
            logger.error(f"Erro ao buscar segredo '{secret_name}': {str(e)}")
            raise
    
    @property
    def azure_speech_key(self) -> str:
        return self._get_secret("azure-speech-key")
    
    @property
    def azure_speech_region(self) -> str:
        return self._get_secret("azure-speech-region")
    
    @property
    def mongodb_connection_string(self) -> str:
        return self.get_secret("MONGODB_CONNECTION_STRING")
    
    @property
    def msal_client_id(self) -> str:
        return self._get_secret("msal-client-id")
    
    @property
    def msal_authority(self) -> str:
        return self._get_secret("msal-authority")
    
    @property
    def msal_client_secret(self) -> str:
        return self._get_secret("msal-client-secret")
    
    @property
    def jwt_secret_key(self) -> str:
        return self.get_secret("JWT_SECRET_KEY")
    
    @property
    def openai_api_key(self) -> str:
        return self._get_secret("openai-api-key")
    
    @property
    def storage_account_name(self) -> str:
        return self._get_secret("storage-account-name")
    
    @property
    def storage_account_key(self) -> str:
        return self._get_secret("storage-account-key")
    
    @property
    def sendgrid_api_key(self) -> str:
        return self._get_secret("sendgrid-api-key")

# -------------------------------
# Instância exportada (sem indentação extra)
# -------------------------------
keyvault_secrets = KeyVaultSecrets()
__all__ = ["keyvault_secrets"]
# Instância global para reutilização
keyvault_secrets = KeyVaultSecrets()
