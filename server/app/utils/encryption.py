from cryptography.fernet import Fernet
from app.core.config import settings


# Initialize cipher with settings
cipher = Fernet(settings.ENCRYPTION_KEY.encode())

def encrypt_token(token: str) -> str:
    """Encrypt a GitHub token for secure storage."""
    if not token:
        return ""
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a GitHub token for API usage."""
    if not encrypted_token:
        return ""
    return cipher.decrypt(encrypted_token.encode()).decode()
