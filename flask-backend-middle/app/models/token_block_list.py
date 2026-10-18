from datetime import UTC, datetime

from sqlalchemy.dialects.postgresql import UUID

from ..extensions import db


class TokenBlockList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(UUID(as_uuid=True), nullable=False, unique=True)
    create_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
