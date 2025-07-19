import azure.functions as func
import json
import logging
import sys
import os
from datetime import datetime
from typing import Dict, Any, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from shared.database import db_manager
from shared.secrets import (
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_TEXT_ANALYTICS_ENDPOINT,
    AZURE_TEXT_ANALYTICS_KEY
)

logger = logging.getLogger(__name__)

class DimensionalExtractor:
    """Motor de Extração Dimensional (MED) simplificado"""
    
    def __init__(self):
        self.dimensions = [
            "valence", "arousal", "coherence", "complexity", "temporal_focus",
            "self_reference", "social_orientation", "abstract_concrete",
            "agency", "fragmentation", "insight", "certainty",
            "emotional_granularity", "narrative_flow", "metacognition"
        ]
    
    async def extract(self, transcript: str) -> Dict[str, List[float]]:
        """
        Extrai as 15 dimensões da transcrição
        Por enquanto, retorna valores simulados para teste
        Em produção, implementar análise real com Azure Text Analytics + OpenAI
        """
        # Simulação de extração dimensional
        import random
        
        # Simula 10 pontos temporais ao longo da sessão
        trajectory = []
        for t in range(10):
            point = {}
            for dim in self.dimensions:
                # Simula valores que variam ao longo do tempo
                base_value = random.uniform(0.3, 0.7)
                variation = random.uniform(-0.1, 0.1)
                point[dim] = max(0, min(1, base_value + variation))
            trajectory.append(point)
        
        return {
            "dimensions": self.dimensions,
            "trajectory": trajectory,
            "summary": {
                "avg_valence": sum(p["valence"] for p in trajectory) / len(trajectory),
                "avg_agency": sum(p["agency"] for p in trajectory) / len(trajectory),
                "coherence_trend": trajectory[-1]["coherence"] - trajectory[0]["coherence"]
            }
        }

class DocumentationAgent:
    """Agente de documentação clínica"""
    
    def __init__(self):
        self.openai_endpoint = AZURE_OPENAI_ENDPOINT
        self.openai_key = AZURE_OPENAI_KEY
        self.deployment = AZURE_OPENAI_DEPLOYMENT
    
    async def generate_documentation(
        self, 
        transcript: str, 
        dimensional_data: Dict[str, Any],
        session_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Gera documentação clínica baseada na transcrição e análise dimensional
        """
        # Por enquanto, retorna template básico
        # Em produção, chamar Azure OpenAI com prompt estruturado
        
        patient_name = session_info.get("patient_name", "Paciente")
        clinician_name = session_info.get("clinician_name", "Dr(a)")
        
        clinical_note = f"""
**NOTA CLÍNICA - SESSÃO DE PSICOTERAPIA**

**Data:** {datetime.utcnow().strftime('%d/%m/%Y')}
**Paciente:** {patient_name}
**Profissional:** {clinician_name}

**DADOS (D):**
Paciente compareceu à sessão demonstrando estado emocional estável. 
Valência emocional média: {dimensional_data['summary']['avg_valence']:.2f}
Senso de agência: {dimensional_data['summary']['avg_agency']:.2f}

**AVALIAÇÃO (A):**
A análise dimensional revela padrões consistentes de engajamento terapêutico.
Coerência narrativa apresentou tendência {('positiva' if dimensional_data['summary']['coherence_trend'] > 0 else 'negativa')}.

**PLANO (P):**
- Continuar explorando temas emergentes
- Fortalecer recursos de enfrentamento identificados
- Próxima sessão agendada para 1 semana
"""
        
        return {
            "clinical_note": clinical_note,
            "document_type": "progress_note",
            "generated_at": datetime.utcnow().isoformat(),
            "dimensional_summary": dimensional_data['summary']
        }

async def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Pipeline de análise assíncrono
    """
    try:
        req_body = req.get_json()
        session_id = req_body.get('session_id')
        
        if not session_id:
            return func.HttpResponse(
                json.dumps({'error': 'session_id é obrigatório'}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )
        
        # Busca a sessão
        session = db_manager.get_session(session_id)
        if not session:
            return func.HttpResponse(
                json.dumps({'error': 'Sessão não encontrada'}),
                status_code=404,
                headers={'Content-Type': 'application/json'}
            )
        
        # Verifica se já foi analisada
        if session.get('status') == 'completed':
            return func.HttpResponse(
                json.dumps({'message': 'Sessão já foi analisada'}),
                status_code=200,
                headers={'Content-Type': 'application/json'}
            )
        
        # Concatena a transcrição
        transcript_segments = session.get('transcription_segments', [])
        full_transcript = ' '.join([seg.get('text', '') for seg in transcript_segments])
        
        if not full_transcript:
            return func.HttpResponse(
                json.dumps({'error': 'Transcrição vazia'}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )
        
        # Executa o MED
        logger.info(f"Iniciando análise dimensional para sessão {session_id}")
        extractor = DimensionalExtractor()
        dimensional_data = await extractor.extract(full_transcript)
        
        # Gera documentação
        logger.info(f"Gerando documentação clínica para sessão {session_id}")
        doc_agent = DocumentationAgent()
        
        # Busca informações do paciente
        patient_id = session.get('patient_id')
        db = db_manager.get_mongo_db()
        patient = db.patients.find_one({"_id": patient_id}) if patient_id else {}
        
        session_info = {
            "patient_name": patient.get('name', 'Paciente'),
            "clinician_name": "Dr(a) Silva",  # Em produção, buscar do token JWT
            "session_number": session.get('session_number', 1)
        }
        
        documentation = await doc_agent.generate_documentation(
            full_transcript,
            dimensional_data,
            session_info
        )
        
        # Salva os resultados
        insight_package = {
            "dimensional_trajectory": dimensional_data,
            "clinical_documents": documentation,
            "analysis_completed_at": datetime.utcnow()
        }
        
        # Atualiza a sessão
        db_manager.update_session(session_id, {
            "status": "completed",
            "insight_package": insight_package
        })
        
        # Salva recurso FHIR
        fhir_resource = {
            "resourceType": "DocumentReference",
            "status": "current",
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "date": datetime.utcnow().isoformat(),
            "content": [{
                "attachment": {
                    "contentType": "text/plain",
                    "data": documentation['clinical_note']
                }
            }]
        }
        
        fhir_id = db_manager.save_fhir_resource("DocumentReference", fhir_resource)
        logger.info(f"Recurso FHIR salvo com ID: {fhir_id}")
        
        return func.HttpResponse(
            json.dumps({
                "message": "Análise concluída com sucesso",
                "session_id": session_id,
                "dimensional_summary": dimensional_data['summary'],
                "documentation_generated": True
            }),
            status_code=200,
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        logger.error(f"Erro no pipeline de análise: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': 'Erro interno do servidor', 'details': str(e)}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )
