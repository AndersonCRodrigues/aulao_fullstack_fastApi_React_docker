"""
app/core/encryption.py
======================
Criptografia simétrica AES-256-GCM para dados sensíveis em repouso.

Por que AES-256-GCM?
    AES-256: chave de 256 bits, resistente a força bruta.
    GCM (Galois/Counter Mode): modo autenticado — garante
        CONFIDENCIALIDADE (ninguém lê) e
        INTEGRIDADE (adulteração detectada via InvalidTag).
    Padrão: NIST SP 800-38D.

Layout do blob armazenado (BYTEA no Postgres):
┌──────────────┬──────────────────┬─────────────┐
│  nonce (12B) │  ciphertext (?B) │  tag (16B)  │
└──────────────┴──────────────────┴─────────────┘

Nonce:
    12 bytes aleatórios por operação (NIST recomendado para GCM).
    Gerado via os.urandom — criptograficamente seguro.
    Nunca reutilizar nonce com a mesma chave (quebraria o GCM).
    Não é segredo; armazenado junto ao ciphertext.
"""

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

_NONCE_SIZE = 12  # 96 bits — recomendação NIST para GCM


def _get_key() -> bytes:
    """Carrega a chave AES de 32 bytes (256 bits) das configurações."""
    return bytes.fromhex(settings.TASK_ENCRYPTION_KEY_HEX)


def encrypt(plaintext: str) -> bytes:
    """
    Cifra texto com AES-256-GCM.

    Retorna: nonce (12B) || ciphertext || tag (16B)
    O mesmo texto produz bytes diferentes a cada chamada (nonce aleatório).
    """
    nonce = os.urandom(_NONCE_SIZE)
    aesgcm = AESGCM(_get_key())
    ciphertext_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ciphertext_tag


def decrypt(blob: bytes) -> str:
    """
    Descriptografa blob gerado por encrypt().

    Raises:
        ValueError               — blob menor que o nonce (dados corrompidos)
        cryptography.exceptions.InvalidTag — bytes adulterados ou chave errada
    """
    if len(blob) <= _NONCE_SIZE:
        raise ValueError(
            f"Blob inválido: {len(blob)}B ≤ nonce ({_NONCE_SIZE}B). "
            "Dados possivelmente corrompidos."
        )
    nonce = blob[:_NONCE_SIZE]
    ciphertext_tag = blob[_NONCE_SIZE:]
    aesgcm = AESGCM(_get_key())
    return aesgcm.decrypt(nonce, ciphertext_tag, None).decode("utf-8")


def encrypt_optional(text: str | None) -> bytes | None:
    """Versão nullable de encrypt() — retorna None se text for None."""
    return encrypt(text) if text is not None else None


def decrypt_optional(blob: bytes | None) -> str | None:
    """Versão nullable de decrypt() — retorna None se blob for None."""
    return decrypt(blob) if blob is not None else None
