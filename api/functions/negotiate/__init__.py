import azure.functions as func
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from shared.secrets import AZURE_SIGNALR_CONNECTION_STRING

logger = logging.getLogger(__name__)

async def main(req: func.HttpRequest, connectionInfo: func.SignalRConnectionInfo) -> func.HttpResponse:
    """
    Endpoint de negociação do SignalR
    Retorna as informações de conexão para o cliente
    """
    try:
        # Por enquanto sem autenticação para testes
        # Em produção, validar o token JWT aqui
        
        return func.HttpResponse(
            json.dumps({
                'url': connectionInfo['url'],
                'accessToken': connectionInfo['accessToken']
            }),
            status_code=200,
            headers={
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        )
    except Exception as e:
        logger.error(f"Erro na negociação SignalR: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': 'Falha na negociação SignalR'}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )
