"""
Script de inicialização do MongoDB
Cria coleções e índices necessários
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from shared.database import db_manager

def init_mongodb():
    """Inicializa as coleções e índices do MongoDB"""
    db = db_manager.get_mongo_db()
    
    # Cria coleções
    collections = ['patients', 'sessions', 'users']
    
    for collection_name in collections:
        if collection_name not in db.list_collection_names():
            db.create_collection(collection_name)
            print(f"Coleção '{collection_name}' criada")
    
    # Cria índices
    # Índices para patients
    db.patients.create_index("clinician_id")
    db.patients.create_index([("name", "text")])
    
    # Índices para sessions
    db.sessions.create_index("patient_id")
    db.sessions.create_index("clinician_id")
    db.sessions.create_index("status")
    db.sessions.create_index("created_at")
    
    # Índices para users
    db.users.create_index("email", unique=True)
    
    print("Índices criados com sucesso")
    
    # Insere dados de teste
    if db.patients.count_documents({}) == 0:
        test_patient = {
            "clinician_id": "test-clinician-id",
            "name": "João Silva",
            "birthDate": "1990-01-15",
            "age": 34,
            "gender": "male",
            "phone": "(11) 98765-4321",
            "email": "joao.silva@email.com",
            "medicalHistory": "Histórico de ansiedade",
            "medications": ["Sertralina 50mg"],
            "allergies": []
        }
        db.patients.insert_one(test_patient)
        print("Paciente de teste inserido")

if __name__ == "__main__":
    init_mongodb()
