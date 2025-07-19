import azure.functions as func
import json
import logging
from datetime import datetime
import asyncio
from typing import Dict, Any, List
import azure.cognitiveservices.speech as speechsdk
import sys
import os
import base64
import io
import uuid
from azure.storage.blob import BlobServiceClient
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from shared.database import db_manager
from shared.secrets import (
    AZURE_SPEECH_KEY, 
    AZURE_SPEECH_REGION,
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER
)

logger = logging.getLogger(__name__)

class TranscriptionSession:
    """Gerencia uma sessão de transcrição em tempo real"""
    
    def __init__(self, session_id: str, patient_id: str, clinician_id: str):
        self.session_id = session_id
        self.patient_id = patient_id
        self.clinician_id = clinician_id
        self.audio_chunks: List[bytes] = []
        self.transcription_segments: List[Dict[str, Any]] = []
        self.start_time = datetime.utcnow()
        self.recognizer = None
        self.is_recognizing = False
        self._setup_speech_recognizer()
    
    def _setup_speech_recognizer(self):
        """Configura o reconhecedor de fala com callbacks"""
        speech_config = speechsdk.SpeechConfig(
            subscription=AZURE_SPEECH_KEY,
            region=AZURE_SPEECH_REGION
        )
        
        # Configurações para português brasileiro
        speech_config.speech_recognition_language = "pt-BR"
        speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "15000"
        )
        speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "5000"
        )
        
        # Habilita pontuação e capitalização
        speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceResponse_ProfanityOption, "raw"
        )
        speech_config.output_format = speechsdk.OutputFormat.Detailed
        
        # Stream de áudio
        self.push_stream = speechsdk.audio.PushAudioInputStream()
        audio_config = speechsdk.audio.AudioConfig(stream=self.push_stream)
        
        # Cria o reconhecedor
        self.recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config
        )
        
        # Configura callbacks
        self.recognizer.recognizing.connect(self._on_recognizing)
        self.recognizer.recognized.connect(self._on_recognized)
        self.recognizer.session_stopped.connect(self._on_session_stopped)
        self.recognizer.canceled.connect(self._on_canceled)
    
    def _on_recognizing(self, evt):
        """Callback para reconhecimento parcial"""
        logger.debug(f"Reconhecendo: {evt.result.text}")
    
    def _on_recognized(self, evt):
        """Callback para reconhecimento completo"""
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            text = evt.result.text.strip()
            if text:
                segment = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "text": text,
                    "speaker": "speaker1",  # TODO: implementar diarização
                    "confidence": 0.95,
                    "offset": evt.result.offset,
                    "duration": evt.result.duration
                }
                self.transcription_segments.append(segment)
                logger.info(f"Segmento reconhecido: {text}")
    
    def _on_session_stopped(self, evt):
        """Callback quando a sessão para"""
        logger.info("Sessão de reconhecimento parada")
        self.is_recognizing = False
    
    def _on_canceled(self, evt):
        """Callback para erros"""
        if evt.reason == speechsdk.CancellationReason.Error:
            logger.error(f"Erro no reconhecimento: {evt.error_details}")
    
    def start_recognition(self):
        """Inicia o reconhecimento contínuo"""
        if not self.is_recognizing:
            self.recognizer.start_continuous_recognition()
            self.is_recognizing = True
            logger.info(f"Reconhecimento iniciado para sessão {self.session_id}")
    
    def process_audio_chunk(self, audio_data: bytes) -> Dict[str, Any]:
        """Processa um chunk de áudio"""
        try:
            # Armazena o chunk
            self.audio_chunks.append(audio_data)
            
            # Envia para o reconhecedor
            self.push_stream.write(audio_data)
            
            # Se não está reconhecendo, inicia
            if not self.is_recognizing:
                self.start_recognition()
            
            # Retorna o último segmento se houver
            if self.transcription_segments:
                last_segment = self.transcription_segments[-1]
                
                # Atualiza no MongoDB
                db_manager.update_session(
                    self.session_id,
                    {
                        "$push": {"transcription_segments": last_segment},
                        "last_updated": datetime.utcnow()
                    }
                )
                
                return {
                    "type": "transcription",
                    "sessionId": self.session_id,
                    "segment": last_segment
                }
            
            return {
                "type": "processing",
                "sessionId": self.session_id,
                "status": "audio_received"
            }
            
        except Exception as e:
            logger.error(f"Erro ao processar áudio: {e}")
            return {
                "type": "error",
                "sessionId": self.session_id,
                "message": str(e)
            }
    
    async def finalize_session(self) -> Dict[str, Any]:
        """Finaliza a sessão e salva o áudio completo"""
        try:
            # Para o reconhecedor
            if self.is_recognizing:
                self.recognizer.stop_continuous_recognition()
                self.is_recognizing = False
            
            # Concatena todos os chunks de áudio em formato WAV
            audio_buffer = io.BytesIO()
            
            # Header WAV simples (16-bit PCM, 16kHz, mono)
            sample_rate = 16000
            num_channels = 1
            bits_per_sample = 16
            
            # Calcula o tamanho total dos dados
            total_audio_size = sum(len(chunk) for chunk in self.audio_chunks)
            
            # Escreve o header WAV
            audio_buffer.write(b'RIFF')
            audio_buffer.write((36 + total_audio_size).to_bytes(4, 'little'))
            audio_buffer.write(b'WAVE')
            audio_buffer.write(b'fmt ')
            audio_buffer.write((16).to_bytes(4, 'little'))
            audio_buffer.write((1).to_bytes(2, 'little'))  # PCM
            audio_buffer.write((num_channels).to_bytes(2, 'little'))
            audio_buffer.write((sample_rate).to_bytes(4, 'little'))
            audio_buffer.write((sample_rate * num_channels * bits_per_sample // 8).to_bytes(4, 'little'))
            audio_buffer.write((num_channels * bits_per_sample // 8).to_bytes(2, 'little'))
            audio_buffer.write((bits_per_sample).to_bytes(2, 'little'))
            audio_buffer.write(b'data')
            audio_buffer.write((total_audio_size).to_bytes(4, 'little'))
            
            # Escreve os dados de áudio
            for chunk in self.audio_chunks:
                audio_buffer.write(chunk)
            
            audio_buffer.seek(0)
            
            # Upload para Azure Blob Storage
            blob_name = f"{self.session_id}.wav"
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            container_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER)
            
            # Cria o container se não existir
            try:
                container_client.create_container()
            except:
                pass  # Container já existe
            
            # Upload do arquivo
            blob_client = container_client.get_blob_client(blob_name)
            blob_client.upload_blob(audio_buffer, overwrite=True)
            
            audio_url = blob_client.url
            
            # Atualiza o status da sessão
            session_update = {
                "status": "transcribed",
                "end_time": datetime.utcnow(),
                "audio_url": audio_url,
                "duration_seconds": (datetime.utcnow() - self.start_time).total_seconds(),
                "total_segments": len(self.transcription_segments)
            }
            
            db_manager.update_session(self.session_id, session_update)
            
            return {
                "type": "session_complete",
                "sessionId": self.session_id,
                "audioUrl": audio_url,
                "totalSegments": len(self.transcription_segments),
                "duration": session_update["duration_seconds"]
            }
            
        except Exception as e:
            logger.error(f"Erro ao finalizar sessão: {e}")
            return {
                "type": "error",
                "sessionId": self.session_id,
                "message": str(e)
            }

# Armazena sessões ativas em memória
active_sessions: Dict[str, TranscriptionSession] = {}

async def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Endpoint principal para transcrição em tempo real
    """
    try:
        # Parse do body da requisição
        req_body = req.get_json()
        action = req_body.get('action')
        session_id = req_body.get('sessionId')
        
        # Endpoint base da API para enviar mensagens SignalR
        signalr_send_url = f"{req.url.split('/api/')[0]}/api/messages"
        
        if action == 'start':
            # Inicia nova sessão
            patient_id = req_body.get('patientId')
            clinician_id = req_body.get('clinicianId', 'test-clinician')
            
            # Gera session_id se não fornecido
            if not session_id:
                session_id = str(uuid.uuid4())
            
            # Cria documento da sessão no MongoDB
            session_data = {
                "session_id": session_id,
                "patient_id": patient_id,
                "clinician_id": clinician_id,
                "status": "recording",
                "start_time": datetime.utcnow(),
                "transcription_segments": []
            }
            
            mongo_id = db_manager.save_session(session_data)
            
            # Cria sessão de transcrição
            session = TranscriptionSession(session_id, patient_id, clinician_id)
            active_sessions[session_id] = session
            
            # Envia notificação via SignalR
            await send_signalr_message(signalr_send_url, {
                "target": "sessionStarted",
                "arguments": [{
                    "sessionId": session_id,
                    "status": "recording"
                }]
            })
            
            return func.HttpResponse(
                json.dumps({
                    "status": "session_started",
                    "sessionId": session_id,
                    "mongoId": mongo_id
                }),
                status_code=200,
                headers={'Content-Type': 'application/json'}
            )
        
        elif action == 'audio':
            # Processa chunk de áudio
            if session_id not in active_sessions:
                return func.HttpResponse(
                    json.dumps({"error": "Sessão não encontrada"}),
                    status_code=404,
                    headers={'Content-Type': 'application/json'}
                )
            
            audio_data = base64.b64decode(req_body.get('audioData', ''))
            session = active_sessions[session_id]
            
            result = session.process_audio_chunk(audio_data)
            
            # Se houver novo segmento de transcrição, envia via SignalR
            if result.get('type') == 'transcription' and result.get('segment'):
                await send_signalr_message(signalr_send_url, {
                    "target": "newTranscriptionSegment",
                    "arguments": [result]
                })
            
            return func.HttpResponse(
                json.dumps(result),
                status_code=200,
                headers={'Content-Type': 'application/json'}
            )
        
        elif action == 'stop':
            # Finaliza sessão
            if session_id not in active_sessions:
                return func.HttpResponse(
                    json.dumps({"error": "Sessão não encontrada"}),
                    status_code=404,
                    headers={'Content-Type': 'application/json'}
                )
            
            session = active_sessions[session_id]
            result = await session.finalize_session()
            
            # Remove da memória
            del active_sessions[session_id]
            
            # Envia notificação via SignalR
            await send_signalr_message(signalr_send_url, {
                "target": "sessionCompleted",
                "arguments": [result]
            })
            
            # TODO: Enviar mensagem para Azure Queue para processamento assíncrono
            
            return func.HttpResponse(
                json.dumps(result),
                status_code=200,
                headers={'Content-Type': 'application/json'}
            )
        
        else:
            return func.HttpResponse(
                json.dumps({"error": "Ação inválida"}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )
            
    except Exception as e:
        logger.error(f"Erro na transcrição em tempo real: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Erro interno do servidor", "details": str(e)}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )

async def send_signalr_message(url: str, message: dict):
    """Envia mensagem via SignalR usando a API"""
    try:
        response = requests.post(url, json=message)
        if response.status_code != 200:
            logger.error(f"Erro ao enviar mensagem SignalR: {response.text}")
    except Exception as e:
        logger.error(f"Erro ao chamar API SignalR: {e}")
