import azure.functions as func
import json
import logging
from datetime import datetime, timedelta
import requests
import sys
import os

# Adiciona o diretório raiz ao path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from shared.secrets import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
from shared.auth import require_auth

logger = logging.getLogger(__name__)

async def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Gera um token de autenticação para o Azure Speech Service
    """
    try:
        # Por enquanto, não requer autenticação para testes
        # @require_auth pode ser adicionado depois
        
        # Endpoint para obter o token
        token_endpoint = f'https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken'
        
        # Headers com a chave de API
        headers = {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        # Faz a requisição para obter o token
        response = requests.post(token_endpoint, headers=headers)
        
        if response.status_code == 200:
            token = response.text
            
            # Retorna o token e a região
            return func.HttpResponse(
                json.dumps({
                    'token': token,
                    'region': AZURE_SPEECH_REGION,
                    'expiresAt': (datetime.utcnow() + timedelta(minutes=9)).isoformat()
                }),
                status_code=200,
                headers={
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            )
        else:
            logger.error(f"Erro ao obter token do Speech Service: {response.status_code} - {response.text}")
            return func.HttpResponse(
                json.dumps({'error': 'Falha ao obter token de fala'}),
                status_code=500,
                headers={'Content-Type': 'application/json'}
            )
            
    except Exception as e:
        logger.error(f"Erro na função get_speech_token: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': 'Erro interno do servidor', 'details': str(e)}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )
