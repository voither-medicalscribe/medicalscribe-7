"""
Módulo de autenticação JWT para Azure Functions.
Exponde:
    - verify_token(token) -> dict | None
    - require_auth decorator
"""

import jwt
import logging
from functools import wraps
from typing import Callable, Optional, Dict, Any

try:
    import azure.functions as func
except ImportError:
    # Ambiente local sem azure-functions instalado
    from utils.mock_functions import func  # type: ignore

from utils.keyvault_secrets import keyvault_secrets

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Funções auxiliares
# -----------------------------------------------------------------------------
def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Valida e decodifica o JWT usando a chave secreta obtida do Key Vault.

    Returns:
        dict   -> payload decodificado se válido
        None   -> caso o token seja inválido / expirado
    """
    try:
        secret_key = keyvault_secrets.jwt_secret_key
        return jwt.decode(
            token,
            secret_key,
            algorithms=["HS256"],
            options={"verify_signature": True}
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Token expirado.")
    except jwt.InvalidTokenError as exc:
        logger.warning("Token inválido: %s", exc)
    except Exception as exc:  # Fallback
        logger.error("Erro ao validar token: %s", exc)
    return None

# -----------------------------------------------------------------------------
# Decorator
# -----------------------------------------------------------------------------
def require_auth(fn: Callable) -> Callable:
    """
    Decorator para Functions HTTP que injeta user_info caso o token seja válido.
    A função decorada deve ter assinatura: def main(req, user_info) -> HttpResponse
    """
    @wraps(fn)
    def wrapper(req: func.HttpRequest, *args, **kwargs):
        auth_header = req.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return func.HttpResponse(
                "Authorization header ausente ou malformado.",
                status_code=401
            )

        token = auth_header.split(" ", 1)[1]
        user_info = verify_token(token)
        if not user_info:
            return func.HttpResponse(
                "Token inválido ou expirado.",
                status_code=401
            )

        # Chama a função original adicionando user_info
        return fn(req, user_info=user_info, *args, **kwargs)

    return wrapper