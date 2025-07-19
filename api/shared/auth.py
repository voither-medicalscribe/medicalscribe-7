"""
Módulo de autenticação usando Azure AD
"""
import logging
from typing import Optional, Dict, Any
from functools import wraps
import jwt
from azure.functions import HttpRequest, HttpResponse
import json
from .secrets import AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID

logger = logging.getLogger(__name__)

class AuthError(Exception):
    """Exceção customizada para erros de autenticação"""
    def __init__(self, error: str, status_code: int):
        self.error = error
        self.status_code = status_code

def get_token_from_header(request: HttpRequest) -> Optional[str]:
    """Extrai o token JWT do header Authorization"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None

def validate_token(token: str) -> Dict[str, Any]:
    """Valida o token JWT do Azure AD"""
    try:
        # Em produção, fazer a validação completa com as chaves públicas do Azure AD
        # Por enquanto, decodificamos sem verificação para desenvolvimento
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        # Validações básicas
        if decoded.get('tid') != AZURE_AD_TENANT_ID:
            raise AuthError('Token de tenant inválido', 401)
        
        if decoded.get('aud') != AZURE_AD_CLIENT_ID:
            raise AuthError('Token de audiência inválida', 401)
        
        return decoded
    except jwt.ExpiredSignatureError:
        raise AuthError('Token expirado', 401)
    except jwt.InvalidTokenError as e:
        raise AuthError(f'Token inválido: {str(e)}', 401)

def require_auth(func):
    """Decorator para proteger endpoints que requerem autenticação"""
    @wraps(func)
    async def wrapper(req: HttpRequest, *args, **kwargs):
        try:
            token = get_token_from_header(req)
            if not token:
                return HttpResponse(
                    json.dumps({"error": "Token não fornecido"}),
                    status_code=401,
                    headers={"Content-Type": "application/json"}
                )
            
            user_info = validate_token(token)
            req.user = user_info  # Adiciona info do usuário ao request
            
            return await func(req, *args, **kwargs)
            
        except AuthError as e:
            return HttpResponse(
                json.dumps({"error": e.error}),
                status_code=e.status_code,
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            logger.error(f"Erro inesperado na autenticação: {e}")
            return HttpResponse(
                json.dumps({"error": "Erro interno de autenticação"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )
    
    return wrapper

def get_user_id(request: HttpRequest) -> Optional[str]:
    """Extrai o ID do usuário do token validado"""
    if hasattr(request, 'user'):
        return request.user.get('oid') or request.user.get('sub')
    return None

def get_user_email(request: HttpRequest) -> Optional[str]:
    """Extrai o email do usuário do token validado"""
    if hasattr(request, 'user'):
        return request.user.get('email') or request.user.get('upn')
    return None
