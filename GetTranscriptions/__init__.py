try:
    import azure.functions as func
except ImportError:
    # Para desenvolvimento local sem o pacote azure-functions instalado
    import sys, os
    sys.path.insert(
        0,
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    from utils.mock_functions import func  # Mock para desenvolvimento local

import json
import logging
from pymongo import MongoClient
from bson import ObjectId, json_util
from datetime import datetime
import os
import sys

from utils.auth import require_auth
from utils.keyvault_secrets import keyvault_secrets

logger = logging.getLogger(__name__)

# Conexão com MongoDB usando Key Vault
client = MongoClient(keyvault_secrets.mongodb_connection_string)
db = client['medical_transcriptions']
collection = db['transcriptions']

@require_auth
def main(req: func.HttpRequest, user_info: dict) -> func.HttpResponse:
    """
    Azure Function para obter transcrições médicas
    Requer autenticação JWT
    """
    try:
        # Obter parâmetros de consulta
        user_id = req.params.get('user_id')
        date_from = req.params.get('date_from')
        date_to = req.params.get('date_to')
        
        # Construir filtro de busca
        query = {}
        
        # Filtrar por usuário se especificado
        if user_id:
            query['user_id'] = user_id
        
        # Filtrar por data se especificado
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter['$gte'] = datetime.fromisoformat(date_from)
            if date_to:
                date_filter['$lte'] = datetime.fromisoformat(date_to)
            query['created_at'] = date_filter
        
        # Buscar transcrições
        transcriptions = list(collection.find(query).sort('created_at', -1))
        
        # Converter ObjectId para string para serialização JSON
        for transcription in transcriptions:
            transcription['_id'] = str(transcription['_id'])
            if 'created_at' in transcription:
                transcription['created_at'] = transcription['created_at'].isoformat()
            if 'updated_at' in transcription:
                transcription['updated_at'] = transcription['updated_at'].isoformat()
        
        return func.HttpResponse(
            json.dumps({
                "transcriptions": transcriptions,
                "count": len(transcriptions),
                "user": user_info
            }, default=json_util.default),
            mimetype="application/json",
            status_code=200
        )
        
    except Exception as e:
        logger.error(f"Erro ao obter transcrições: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Erro ao processar solicitação", "details": str(e)}),
            mimetype="application/json",
            status_code=500
        )