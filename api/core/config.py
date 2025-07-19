"""
Configuração central da aplicação
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from api.shared.secrets import secrets, config
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Configurações da aplicação usando secrets do Key Vault"""
    
    # API Configuration
    api_title: str = "VOITHER MedicalScribe API"
    api_version: str = "1.0.0"
    api_description: str = "API para transcrição e análise médica"
    
    # Azure Speech Services
    @property
    def azure_speech_key(self):
        return secrets.speech_key
    
    @property
    def azure_speech_region(self):
        return secrets.speech_region
    
    @property
    def azure_speech_endpoint(self):
        return secrets.speech_endpoint
    
    # Azure OpenAI
    @property
    def azure_openai_endpoint(self):
        return secrets.openai_endpoint
    
    @property
    def azure_openai_key(self):
        return secrets.openai_key
    
    @property
    def azure_openai_deployment(self):
        return secrets.openai_deployment
    
    # Database
    @property
    def mongodb_url(self):
        return secrets.mongodb_connection_string
    
    @property
    def database_name(self):
        return secrets.mongodb_database or "voither_medical"
    
    # SignalR
    @property
    def signalr_connection_string(self):
        return secrets.signalr_connection_string
    
    # Redis
    @property
    def redis_url(self):
        return secrets.redis_connection_string
    
    # Application Insights
    @property
    def app_insights_connection_string(self):
        return secrets.app_insights_connection_string
    
    @property
    def app_insights_instrumentation_key(self):
        return secrets.app_insights_instrumentation_key
    
    # CORS - apenas domínios de produção do Azure
    cors_origins: list = [
        "https://*.azurewebsites.net",
        "https://*.azurestaticapps.net",
        "https://*.azure.com"
    ]
    
    # Validação de configuração
    def validate_config(self):
        """Valida se todas as configurações necessárias estão disponíveis"""
        required_secrets = [
            "AZURE_SPEECH_KEY",
            "AZURE_SPEECH_REGION",
            "AZURE_OPENAI_ENDPOINT",
            "AZURE_OPENAI_KEY",
            "MONGODB_CONNECTION_STRING",
            "AZURE_SIGNALR_CONNECTION_STRING"
        ]
        
        validation = config.validate_secrets(required_secrets)
        
        if not validation["all_available"]:
            logger.error(f"Configurações faltando: {validation['missing']}")
            raise ValueError(f"Secrets obrigatórios não encontrados: {', '.join(validation['missing'])}")
        
        logger.info("Todas as configurações validadas com sucesso")
        return True
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignora campos extras como REACT_APP_*

@lru_cache()
def get_settings():
    """Retorna instância única das configurações"""
    settings = Settings()
    settings.validate_config()
    return settings
