import os
import uuid
from datetime import datetime

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__, template_folder="app/templates")
app.secret_key = "chuyen-doi-secret-key-cua-ban-o-day"

# --- DATABASE CONFIGURATION ---
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- MODELS ---
class User(db.Model):
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

class Post(db.Model):
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
        # Format likes as dictionary mapping userId -> {name, avatar}
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
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.String(36), db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.String(36), nullable=False)
    user_name = db.Column(db.String(120))
    user_avatar = db.Column(db.String(20))

class Notification(db.Model):
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

# Ensure database tables are created
with app.app_context():
    db.create_all()

UPLOAD_FOLDER = os.path.join(app.root_path, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# --- TRANG GIAO DIỆN ---

@app.route("/")
def index():
    if "user_id" not in session:
        return redirect(url_for("login_page"))
    user = User.query.get(session["user_id"])
    if not user:
        session.pop("user_id", None)
        return redirect(url_for("login_page"))
    return render_template("index.html")

@app.route("/login")
def login_page():
    if "user_id" in session:
        user = User.query.get(session["user_id"])
        if user:
            return redirect(url_for("index"))
    return render_template("login.html")

@app.route("/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

# --- API AUTHENTICATION ---

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    name = data.get("name", "").strip()
    avatar = data.get("avatar", "🦊")

    if not username or not password or not name:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ thông tin!"}), 400

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"success": False, "message": "Tên đăng nhập đã tồn tại!"}), 400

    new_user = User(username=username, password=password, name=name, avatar=avatar)
    db.session.add(new_user)
    db.session.commit()

    session["user_id"] = new_user.id
    return jsonify({"success": True, "message": "Đăng ký thành công!"})

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    user = User.query.filter_by(username=username, password=password).first()
    if not user:
        return jsonify({"success": False, "message": "Tài khoản hoặc mật khẩu không chính xác!"}), 401

    session["user_id"] = user.id
    return jsonify({"success": True, "message": "Đăng nhập thành công!"})

@app.route("/api/auth/me", methods=["GET"])
def get_me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "user": None}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "user": None}), 401
        
    return jsonify({"success": True, "user": user.to_dict()})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"success": True})

@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    return jsonify({"success": True, "user": user.to_dict()})

# --- API BÀI ĐĂNG (LOCKET) ---

@app.route("/api/photos", methods=["POST"])
def create_photo():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401

    current_user = User.query.get(user_id)
    if not current_user:
        return jsonify({"success": False, "message": "User không tồn tại"}), 401

    if "image" not in request.files:
        return jsonify({"success": False, "message": "Không có ảnh được gửi lên!"}), 400

    file = request.files["image"]
    caption = request.form.get("caption", "")

    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))

    new_post = Post(
        imageUrl=f"/uploads/{filename}",
        caption=caption,
        senderName=current_user.name,
        senderAvatar=current_user.avatar,
        userId=current_user.id,
        createdAt=datetime.now().isoformat()
    )
    db.session.add(new_post)
    db.session.commit()

    return jsonify({"success": True, "photo": new_post.to_dict()})

@app.route("/api/photos", methods=["GET"])
def get_photos():
    posts = Post.query.order_by(Post.createdAt.desc()).all()
    return jsonify({"success": True, "photos": [p.to_dict() for p in posts]})

@app.route("/api/photos/<photo_id>/like", methods=["POST"])
def toggle_like(photo_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401
        
    current_user = User.query.get(user_id)
    post = Post.query.get(photo_id)
    
    if not post:
        return jsonify({"success": False, "message": "Bài viết không tồn tại!"}), 404

    existing_like = Like.query.filter_by(post_id=photo_id, user_id=user_id).first()
    
    if existing_like:
        db.session.delete(existing_like)
    else:
        new_like = Like(
            post_id=photo_id,
            user_id=user_id,
            user_name=current_user.name,
            user_avatar=current_user.avatar
        )
        db.session.add(new_like)
        
        # Create notification if liker is not post owner
        if user_id != post.userId:
            notif = Notification(
                userId=post.userId,
                senderId=user_id,
                senderName=current_user.name,
                senderAvatar=current_user.avatar,
                photoId=photo_id,
                photoUrl=post.imageUrl,
                type="like",
                createdAt=datetime.now().isoformat()
            )
            db.session.add(notif)
            
    db.session.commit()
    
    # Reload post to get updated likes
    return jsonify({"success": True, "likes": post.to_dict()["likes"]})

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401
        
    notifs = Notification.query.filter_by(userId=user_id).order_by(Notification.createdAt.desc()).all()
    return jsonify({"success": True, "notifications": [n.to_dict() for n in notifs]})

@app.route("/api/notifications/read", methods=["POST"])
def mark_notifications_read():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401
        
    unread_notifs = Notification.query.filter_by(userId=user_id, read=False).all()
    for n in unread_notifs:
        n.read = True
    db.session.commit()
            
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
