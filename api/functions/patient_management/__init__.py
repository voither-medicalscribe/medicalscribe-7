import azure.functions as func
import json
import logging
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from shared.database import db_manager
from shared.auth import get_user_id, get_user_email

logger = logging.getLogger(__name__)

async def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Gerenciamento de pacientes (CRUD)
    """
    try:
        # Por enquanto, simula um user_id para testes
        # Em produção, usar: user_id = get_user_id(req)
        user_id = "test-clinician-id"
        
        method = req.method
        route_params = req.route_params
        patient_id = route_params.get('patient_id')
        
        if method == 'GET' and not patient_id:
            # Listar todos os pacientes do clínico
            return await list_patients(user_id)
        
        elif method == 'GET' and patient_id:
            # Buscar paciente específico
            return await get_patient(user_id, patient_id)
        
        elif method == 'POST':
            # Criar novo paciente
            req_body = req.get_json()
            return await create_patient(user_id, req_body)
        
        elif method == 'PUT' and patient_id:
            # Atualizar paciente
            req_body = req.get_json()
            return await update_patient(user_id, patient_id, req_body)
        
        elif method == 'DELETE' and patient_id:
            # Deletar paciente (soft delete)
            return await delete_patient(user_id, patient_id)
        
        else:
            return func.HttpResponse(
                json.dumps({'error': 'Método não suportado'}),
                status_code=405,
                headers={'Content-Type': 'application/json'}
            )
            
    except Exception as e:
        logger.error(f"Erro no gerenciamento de pacientes: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': 'Erro interno do servidor', 'details': str(e)}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )

async def list_patients(clinician_id: str) -> func.HttpResponse:
    """Lista todos os pacientes de um clínico"""
    try:
        db = db_manager.get_mongo_db()
        patients = list(db.patients.find(
            {
                "clinician_id": clinician_id,
                "deleted": {"$ne": True}
            },
            {"_id": 1, "name": 1, "age": 1, "gender": 1, "last_session": 1}
        ))
        
        # Converte ObjectId para string
        for patient in patients:
            patient['id'] = str(patient.pop('_id'))
        
        return func.HttpResponse(
            json.dumps({"patients": patients}),
            status_code=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        logger.error(f"Erro ao listar pacientes: {e}")
        raise

async def get_patient(clinician_id: str, patient_id: str) -> func.HttpResponse:
    """Busca um paciente específico com suas sessões"""
    try:
        from bson import ObjectId
        db = db_manager.get_mongo_db()
        
        # Busca o paciente
        patient = db.patients.find_one({
            "_id": ObjectId(patient_id),
            "clinician_id": clinician_id,
            "deleted": {"$ne": True}
        })
        
        if not patient:
            return func.HttpResponse(
                json.dumps({'error': 'Paciente não encontrado'}),
                status_code=404,
                headers={'Content-Type': 'application/json'}
            )
        
        patient['id'] = str(patient.pop('_id'))
        
        # Busca as sessões do paciente
        sessions = db_manager.get_patient_sessions(patient_id)
        patient['sessions'] = sessions
        
        return func.HttpResponse(
            json.dumps(patient),
            status_code=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        logger.error(f"Erro ao buscar paciente: {e}")
        raise

async def create_patient(clinician_id: str, patient_data: dict) -> func.HttpResponse:
    """Cria um novo paciente"""
    try:
        db = db_manager.get_mongo_db()
        
        # Validação básica
        required_fields = ['name', 'birthDate', 'gender']
        for field in required_fields:
            if field not in patient_data:
                return func.HttpResponse(
                    json.dumps({'error': f'Campo obrigatório ausente: {field}'}),
                    status_code=400,
                    headers={'Content-Type': 'application/json'}
                )
        
        # Calcula idade
        from datetime import datetime
        birth_date = datetime.fromisoformat(patient_data['birthDate'].replace('Z', '+00:00'))
        age = (datetime.now() - birth_date).days // 365
        
        # Prepara documento
        patient_doc = {
            "clinician_id": clinician_id,
            "name": patient_data['name'],
            "birthDate": patient_data['birthDate'],
            "age": age,
            "gender": patient_data['gender'],
            "phone": patient_data.get('phone', ''),
            "email": patient_data.get('email', ''),
            "medicalHistory": patient_data.get('medicalHistory', ''),
            "medications": patient_data.get('medications', []),
            "allergies": patient_data.get('allergies', []),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insere no MongoDB
        result = db.patients.insert_one(patient_doc)
        patient_doc['id'] = str(result.inserted_id)
        patient_doc.pop('_id', None)
        
        return func.HttpResponse(
            json.dumps(patient_doc),
            status_code=201,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        logger.error(f"Erro ao criar paciente: {e}")
        raise

async def update_patient(clinician_id: str, patient_id: str, update_data: dict) -> func.HttpResponse:
    """Atualiza dados de um paciente"""
    try:
        from bson import ObjectId
        db = db_manager.get_mongo_db()
        
        # Remove campos que não devem ser atualizados
        update_data.pop('_id', None)
        update_data.pop('id', None)
        update_data.pop('clinician_id', None)
        update_data['updated_at'] = datetime.utcnow()
        
        # Atualiza
        result = db.patients.update_one(
            {
                "_id": ObjectId(patient_id),
                "clinician_id": clinician_id
            },
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            return func.HttpResponse(
                json.dumps({'error': 'Paciente não encontrado ou sem alterações'}),
                status_code=404,
                headers={'Content-Type': 'application/json'}
            )
        
        return func.HttpResponse(
            json.dumps({'message': 'Paciente atualizado com sucesso'}),
            status_code=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        logger.error(f"Erro ao atualizar paciente: {e}")
        raise

async def delete_patient(clinician_id: str, patient_id: str) -> func.HttpResponse:
    """Soft delete de um paciente"""
    try:
        from bson import ObjectId
        db = db_manager.get_mongo_db()
        
        # Soft delete
        result = db.patients.update_one(
            {
                "_id": ObjectId(patient_id),
                "clinician_id": clinician_id
            },
            {
                "$set": {
                    "deleted": True,
                    "deleted_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return func.HttpResponse(
                json.dumps({'error': 'Paciente não encontrado'}),
                status_code=404,
                headers={'Content-Type': 'application/json'}
            )
        
        return func.HttpResponse(
            json.dumps({'message': 'Paciente removido com sucesso'}),
            status_code=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        logger.error(f"Erro ao deletar paciente: {e}")
        raise
