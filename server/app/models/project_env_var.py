import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ProjectEnvVar(Base):
    """
    Per-project environment variables — zero knowledge encrypted.

    The VALUE of each variable is AES-256-GCM encrypted in the browser.
    We store only ciphertext. We cannot read the values.

    The KEY NAME (e.g. STRIPE_KEY) is stored in plaintext as a hint —
    so the UI can show "you have STRIPE_KEY configured" without decrypting.

    Structure of encrypted_vars:
    [
      {
        "key_name":         "STRIPE_KEY",           <- plaintext (hint only)
        "ciphertext":       "base64encodeddata...", <- AES-256-GCM encrypted value
        "iv":               "base64encodediv...",   <- GCM initialization vector
        "is_secret":        true                    <- whether to mask in UI
      },
      {
        "key_name":  "APP_NAME",
        "ciphertext": "...",
        "iv":         "...",
        "is_secret":  false
      }
    ]
    """
    __tablename__ = "project_env_vars"
    id:             Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    build_id:       Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builds.id", ondelete="SET NULL"), nullable=True)

    # Array of encrypted variable objects (see docstring above)
    encrypted_vars: Mapped[list]      = mapped_column(JSONB, nullable=False, default=list)

    # PBKDF2 salt used for key derivation (not secret, unique per save)
    kdf_salt:       Mapped[str]       = mapped_column(String, nullable=False)

    # Whether these vars have been confirmed/used for deployment
    deployed:       Mapped[bool]      = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project: Mapped["Project"] = relationship("Project", back_populates="env_vars")
