import uuid
from app.extensions import db

class Post(db.Model):
    __tablename__ = 'post'

    id = db.Column(db.String(36), primary_key=True, default=lambda: uuid.uuid4().hex)
    imageUrl = db.Column(db.String(255), nullable=False)
    caption = db.Column(db.String(255))
    senderName = db.Column(db.String(120))
    senderAvatar = db.Column(db.String(20))
    userId = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    createdAt = db.Column(db.String(50))
    
    # Relationship to likes
    likes = db.relationship('Like', backref='post', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        likes_dict = {like.user_id: {"name": like.user_name, "avatar": like.user_avatar} for like in self.likes}
        return {
            "id": self.id,
            "imageUrl": self.imageUrl,
            "caption": self.caption,
            "senderName": self.senderName,
            "senderAvatar": self.senderAvatar,
            "userId": self.userId,
            "likes": likes_dict,
            "createdAt": self.createdAt
        }

class Like(db.Model):
    __tablename__ = 'like'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.String(36), db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.String(36), nullable=False)
    user_name = db.Column(db.String(120))
    user_avatar = db.Column(db.String(20))
