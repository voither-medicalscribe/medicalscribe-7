import azure.functions as func
import json
import jwt
import logging
from datetime import datetime, timedelta
import msal
import os
import sys

# Adicionar o diretório pai ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.keyvault_secrets import keyvault_secrets

logger = logging.getLogger(__name__)

# Configuração MSAL usando Key Vault
MSAL_CONFIG = {
    "client_id": keyvault_secrets.msal_client_id,
    "authority": keyvault_secrets.msal_authority,
    "client_secret": keyvault_secrets.msal_client_secret,
    "scope": ["User.Read"]
}

def generate_jwt_token(user_info: dict) -> str:
    """Gera um token JWT para o usuário autenticado"""
    secret_key = keyvault_secrets.jwt_secret_key
    
    payload = {
        'user_id': user_info.get('id'),
        'email': user_info.get('mail') or user_info.get('userPrincipalName'),
        'name': user_info.get('displayName'),
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, secret_key, algorithm='HS256')