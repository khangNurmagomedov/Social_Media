import uuid
from app.extensions import db

class User(db.Model):
    __tablename__ = 'user'

    id = db.Column(db.String(36), primary_key=True, default=lambda: f"user_{uuid.uuid4().hex[:8]}")
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    avatar = db.Column(db.String(20), default="🦊")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "name": self.name,
            "avatar": self.avatar
        }
