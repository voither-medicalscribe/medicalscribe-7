"""
Gerenciamento de conexões com bancos de dados
"""
import logging
from typing import Optional, Dict, Any, List
from pymongo import MongoClient
from pymongo.database import Database
import pyodbc
from contextlib import contextmanager
import json
from datetime import datetime
from .secrets import (
    MONGODB_CONNECTION_STRING, 
    MONGODB_DATABASE, 
    SQL_SERVER_CONNECTION_STRING,
    AZURE_REDIS_CONNECTION_STRING
)
import redis

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Gerenciador centralizado de conexões de banco de dados"""
    
    def __init__(self):
        self._mongo_client: Optional[MongoClient] = None
        self._mongo_db: Optional[Database] = None
        self._sql_connection_string = SQL_SERVER_CONNECTION_STRING
        self._redis_client: Optional[redis.StrictRedis] = None
    
    def get_mongo_db(self) -> Database:
        """Retorna a instância do MongoDB"""
        if not self._mongo_client:
            try:
                self._mongo_client = MongoClient(MONGODB_CONNECTION_STRING)
                self._mongo_db = self._mongo_client[MONGODB_DATABASE]
                # Testa a conexão
                self._mongo_client.admin.command('ping')
                logger.info("Conectado ao MongoDB Atlas com sucesso")
            except Exception as e:
                logger.error(f"Erro ao conectar ao MongoDB: {e}")
                raise
        
        return self._mongo_db
    
    def get_redis_client(self) -> redis.StrictRedis:
        """Retorna o cliente Redis para cache"""
        if not self._redis_client:
            try:
                self._redis_client = redis.StrictRedis.from_url(
                    AZURE_REDIS_CONNECTION_STRING,
                    decode_responses=True
                )
                self._redis_client.ping()
                logger.info("Conectado ao Redis com sucesso")
            except Exception as e:
                logger.error(f"Erro ao conectar ao Redis: {e}")
                raise
        
        return self._redis_client
    
    @contextmanager
    def get_sql_connection(self):
        """Context manager para conexão SQL Server"""
        conn = None
        try:
            conn = pyodbc.connect(self._sql_connection_string)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Erro na transação SQL Server: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def save_session(self, session_data: Dict[str, Any]) -> str:
        """Salva uma sessão no MongoDB"""
        db = self.get_mongo_db()
        session_data['created_at'] = datetime.utcnow()
        session_data['updated_at'] = datetime.utcnow()
        result = db.sessions.insert_one(session_data)
        return str(result.inserted_id)
    
    def update_session(self, session_id: str, update_data: Dict[str, Any]) -> bool:
        """Atualiza uma sessão existente"""
        from bson import ObjectId
        db = self.get_mongo_db()
        update_data['updated_at'] = datetime.utcnow()
        result = db.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Busca uma sessão pelo ID"""
        from bson import ObjectId
        db = self.get_mongo_db()
        return db.sessions.find_one({"_id": ObjectId(session_id)})
    
    def get_patient_sessions(self, patient_id: str) -> List[Dict[str, Any]]:
        """Busca todas as sessões de um paciente"""
        db = self.get_mongo_db()
        sessions = list(db.sessions.find(
            {"patient_id": patient_id},
            {"transcription_segments": 0}  # Exclui dados pesados
        ).sort("created_at", -1))
        
        # Converte ObjectId para string
        for session in sessions:
            session['_id'] = str(session['_id'])
        
        return sessions
    
    def save_fhir_resource(self, resource_type: str, resource_data: Dict[str, Any]) -> int:
        """Salva um recurso FHIR no SQL Server"""
        with self.get_sql_connection() as conn:
            cursor = conn.cursor()
            
            # Cria tabela se não existir
            cursor.execute("""
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='fhir_resources' AND xtype='U')
                CREATE TABLE fhir_resources (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    resource_type NVARCHAR(50),
                    data NVARCHAR(MAX),
                    status NVARCHAR(20),
                    created_at DATETIME2 DEFAULT GETUTCDATE(),
                    updated_at DATETIME2 DEFAULT GETUTCDATE()
                )
            """)
            
            # Insere o recurso
            cursor.execute("""
                INSERT INTO fhir_resources (resource_type, data, status)
                VALUES (?, ?, ?)
            """, (resource_type, json.dumps(resource_data), 'active'))
            
            cursor.execute("SELECT @@IDENTITY AS id")
            return cursor.fetchone()[0]
    
    def cache_get(self, key: str) -> Optional[str]:
        """Busca valor do cache Redis"""
        try:
            redis_client = self.get_redis_client()
            return redis_client.get(key)
        except Exception as e:
            logger.warning(f"Erro ao buscar do cache: {e}")
            return None
    
    def cache_set(self, key: str, value: str, expire_seconds: int = 300):
        """Armazena valor no cache Redis"""
        try:
            redis_client = self.get_redis_client()
            redis_client.setex(key, expire_seconds, value)
        except Exception as e:
            logger.warning(f"Erro ao salvar no cache: {e}")

# Instância singleton
db_manager = DatabaseManager()
