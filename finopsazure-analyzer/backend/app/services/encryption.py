"""Fernet-based symmetric encryption for secrets at rest.

The key comes from FINOPS_CONFIG_ENCRYPTION_KEY. In Azure this value is
delivered via Key Vault -> Container App secret ref, never hardcoded.
"""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from ..config import get_settings


class EncryptionError(RuntimeError):
    pass


def _fernet() -> Fernet:
    key = get_settings().finops_config_encryption_key
    if not key:
        raise EncryptionError(
            "FINOPS_CONFIG_ENCRYPTION_KEY no está configurada. "
            "Genera una con: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        raise EncryptionError("FINOPS_CONFIG_ENCRYPTION_KEY no es una clave Fernet válida") from exc


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise EncryptionError("No se pudo descifrar el secreto (clave incorrecta o dato corrupto)") from exc
