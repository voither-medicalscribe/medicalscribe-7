import azure.functions as func
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

logger = logging.getLogger(__name__)

async def main(req: func.HttpRequest, signalRMessages: func.Out[str]) -> func.HttpResponse:
    """
    Envia mensagens para clientes conectados via SignalR
    """
    try:
        req_body = req.get_json()
        
        # Validação básica
        if not req_body.get('target') or not req_body.get('arguments'):
            return func.HttpResponse(
                json.dumps({'error': 'Target e arguments são obrigatórios'}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )
        
        # Prepara a mensagem para o SignalR
        message = {
            'target': req_body['target'],
            'arguments': req_body['arguments']
        }
        
        # Se houver userId específico, envia apenas para ele
        if req_body.get('userId'):
            message['userId'] = req_body['userId']
        
        # Se houver groupName, envia para o grupo
        if req_body.get('groupName'):
            message['groupName'] = req_body['groupName']
        
        # Envia a mensagem
        signalRMessages.set(json.dumps(message))
        
        return func.HttpResponse(
            json.dumps({'status': 'Message sent successfully'}),
            status_code=200,
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem SignalR: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': 'Falha ao enviar mensagem'}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )
