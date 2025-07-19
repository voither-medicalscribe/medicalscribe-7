import azure.functions as func
import azure.cognitiveservices.speech as speechsdk
import json
import logging
import os
import sys
from datetime import datetime
import uuid
from pymongo import MongoClient
from typing import Optional, Dict, Any
import openai

# Adicionar o diretório pai ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.auth import require_auth
from utils.keyvault_secrets import keyvault_secrets

logger = logging.getLogger(__name__)

# Configurações do Azure Speech usando Key Vault
SPEECH_KEY = keyvault_secrets.azure_speech_key
SPEECH_REGION = keyvault_secrets.azure_speech_region

# Configuração do OpenAI
openai.api_key = keyvault_secrets.openai_api_key

# Conexão com MongoDB
client = MongoClient(keyvault_secrets.mongodb_connection_string)
db = client['medical_transcriptions']
collection = db['transcriptions']

def transcribe_audio(audio_data: bytes, language: str = "pt-BR") -> Optional[str]:
    """Transcreve áudio usando Azure Speech Services"""
    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=SPEECH_KEY,
            region=SPEECH_REGION
        )
        speech_config.speech_recognition_language = language
        
        # Configurar o reconhecedor de fala
        audio_stream = speechsdk.audio.PushAudioInputStream()
        audio_config = speechsdk.audio.AudioConfig(stream=audio_stream)
        
        speech_recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config
        )
        
        # Enviar dados de áudio
        audio_stream.write(audio_data)
        audio_stream.close()
        
        # Realizar transcrição
        result = speech_recognizer.recognize_once()
        
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return result.text
        elif result.reason == speechsdk.ResultReason.NoMatch:
            logger.warning("Nenhuma fala foi reconhecida no áudio")
            return None
        else:
            logger.error(f"Erro na transcrição: {result.reason}")
            return None
            
    except Exception as e:
        logger.error(f"Erro ao transcrever áudio: {str(e)}")
        return None

def process_medical_text(text: str) -> Dict[str, Any]:
    """Processa o texto médico usando OpenAI"""
    try:
        prompt = f"""
        Analise o seguinte texto de transcrição médica e extraia as informações estruturadas:
        
        Texto: {text}
        
        Por favor, forneça uma resposta em JSON com os seguintes campos:
        - resumo: Um resumo conciso da consulta
        - sintomas: Lista de sintomas mencionados
        - diagnostico: Diagnóstico mencionado (se houver)
        - prescricoes: Lista de medicamentos prescritos
        - exames: Exames solicitados
        - observacoes: Outras observações relevantes
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Você é um assistente médico especializado em processar transcrições médicas."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        result = response.choices[0].message.content
        return json.loads(result)
        
    except Exception as e:
        logger.error(f"Erro ao processar texto médico: {str(e)}")
        return {
            "resumo": "Erro ao processar",
            "sintomas": [],
            "diagnostico": "",
            "prescricoes": [],
            "exames": [],
            "observacoes": str(e)
        }

@require_auth
def main(req: func.HttpRequest, user_info: dict) -> func.HttpResponse:
    """
    Azure Function para processar áudio e gerar transcrição médica
    """
    try:
        # Obter dados do áudio
        audio_data = req.get_body()
        
        if not audio_data:
            return func.HttpResponse(
                json.dumps({"error": "Nenhum dado de áudio fornecido"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Obter metadados da requisição
        headers = dict(req.headers)
        patient_id = headers.get('x-patient-id', 'unknown')
        doctor_id = user_info.get('user_id')
        
        # Transcrever áudio
        transcription = transcribe_audio(audio_data)
        
        if not transcription:
            return func.HttpResponse(
                json.dumps({"error": "Falha ao transcrever áudio"}),
                mimetype="application/json",
                status_code=422
            )
        
        # Processar texto médico
        medical_data = process_medical_text(transcription)
        
        # Criar documento para salvar no MongoDB
        document = {
            "_id": str(uuid.uuid4()),
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "transcription": transcription,
            "medical_data": medical_data,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "status": "completed",
            "audio_size": len(audio_data),
            "language": "pt-BR"
        }
        
        # Salvar no MongoDB
        collection.insert_one(document)
        
        # Remover _id do MongoDB para resposta
        document.pop('_id', None)
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "transcription_id": document.get("_id"),
                "transcription": transcription,
                "medical_data": medical_data,
                "created_at": document["created_at"].isoformat()
            }),
            mimetype="application/json",
            status_code=200
        )
        
    except Exception as e:
        logger.error(f"Erro ao processar áudio: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": "Erro ao processar áudio",
                "details": str(e)
            }),
            mimetype="application/json",
            status_code=500
        )