"""
Script para validar se todos os secrets estão configurados corretamente
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.shared.secrets import config
from api.core.config import get_settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def validate_all_secrets():
    """Valida todos os secrets necessários"""
    
    print("=" * 60)
    print("VALIDAÇÃO DE SECRETS - VOITHER MedicalScribe")
    print("=" * 60)
    
    # Lista de todos os secrets necessários
    all_secrets = [
        # Speech Services
        "AZURE_SPEECH_KEY",
        "AZURE_SPEECH_REGION",
        "AZURE_SPEECH_ENDPOINT",
        
        # OpenAI Principal
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_KEY",
        "AZURE_OPENAI_DEPLOYMENT",
        "AZURE_OPENAI_DEPLOYMENT_MINI",
        
        # OpenAI Secondary
        "AZURE_OPENAI_SECONDARY_ENDPOINT",
        "AZURE_OPENAI_SECONDARY_KEY",
        "AZURE_OPENAI_SECONDARY_DEPLOYMENT",
        "AZURE_OPENAI_WHISPER_DEPLOYMENT",
        
        # Text Analytics
        "AZURE_TEXT_ANALYTICS_ENDPOINT",
        "AZURE_TEXT_ANALYTICS_KEY",
        
        # SignalR
        "AZURE_SIGNALR_CONNECTION_STRING",
        
        # MongoDB
        "MONGODB_CONNECTION_STRING",
        "MONGODB_DATABASE",
        
        # SQL Server
        "SQL_SERVER_CONNECTION_STRING",
        
        # Redis
        "AZURE_REDIS_CONNECTION_STRING",
        
        # Azure AD
        "AZURE_AD_TENANT_ID",
        "AZURE_AD_CLIENT_ID",
        "AZURE_AD_CLIENT_SECRET",
        
        # Application Insights
        "APP_INSIGHTS_CONNECTION_STRING",
        "APP_INSIGHTS_INSTRUMENTATION_KEY",
        
        # Azure Info
        "AZURE_SUBSCRIPTION_ID",
        "AZURE_RESOURCE_GROUP",
        "AZURE_LOCATION"
    ]
    
    print(f"\nValidando {len(all_secrets)} secrets...")
    print("-" * 60)
    
    validation = config.validate_secrets(all_secrets)
    
    # Mostrar status de cada secret
    for secret in all_secrets:
        status = "✅ OK" if validation["status"].get(secret, False) else "❌ FALTANDO"
        print(f"{secret:.<50} {status}")
    
    print("-" * 60)
    
    if validation["all_available"]:
        print("\n✅ TODOS OS SECRETS ESTÃO CONFIGURADOS!")
    else:
        print(f"\n❌ {len(validation['missing'])} SECRETS FALTANDO:")
        for secret in validation['missing']:
            print(f"   - {secret}")
    
    # Testar configurações da aplicação
    print("\n" + "=" * 60)
    print("TESTANDO CONFIGURAÇÕES DA APLICAÇÃO")
    print("=" * 60)
    
    try:
        settings = get_settings()
        print("✅ Configurações da aplicação carregadas com sucesso!")
        
        # Testar alguns valores específicos
        tests = [
            ("API Title", settings.api_title),
            ("Speech Region", settings.azure_speech_region),
            ("OpenAI Endpoint", settings.azure_openai_endpoint[:50] + "..."),
            ("Database Name", settings.database_name)
        ]
        
        for name, value in tests:
            if value:
                print(f"✅ {name}: {value}")
            else:
                print(f"❌ {name}: NÃO CONFIGURADO")
                
    except Exception as e:
        print(f"❌ Erro ao carregar configurações: {e}")
    
    print("\n" + "=" * 60)
    
    return validation["all_available"]

if __name__ == "__main__":
    success = validate_all_secrets()
    sys.exit(0 if success else 1)
