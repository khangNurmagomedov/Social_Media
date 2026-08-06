import uuid
from app.extensions import db

class Notification(db.Model):
    __tablename__ = 'notification'

    id = db.Column(db.String(36), primary_key=True, default=lambda: uuid.uuid4().hex)
    userId = db.Column(db.String(36), nullable=False) # Người nhận
    senderId = db.Column(db.String(36))
    senderName = db.Column(db.String(120))
    senderAvatar = db.Column(db.String(20))
    photoId = db.Column(db.String(36))
    photoUrl = db.Column(db.String(255))
    type = db.Column(db.String(20))
    createdAt = db.Column(db.String(50))
    read = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.userId,
            "senderId": self.senderId,
            "senderName": self.senderName,
            "senderAvatar": self.senderAvatar,
            "photoId": self.photoId,
            "photoUrl": self.photoUrl,
            "type": self.type,
            "createdAt": self.createdAt,
            "read": self.read
        }
