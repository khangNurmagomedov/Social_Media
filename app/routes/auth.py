from flask import Blueprint, request, jsonify, session
from app.extensions import db
from app.models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route("/api/auth/register", methods=["POST"])
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

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    user = User.query.filter_by(username=username, password=password).first()
    if not user:
        return jsonify({"success": False, "message": "Tài khoản hoặc mật khẩu không chính xác!"}), 401

    session["user_id"] = user.id
    return jsonify({"success": True, "message": "Đăng nhập thành công!"})

@auth_bp.route("/api/auth/me", methods=["GET"])
def get_me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "user": None}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "user": None}), 401
        
    return jsonify({"success": True, "user": user.to_dict()})

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"success": True})

@auth_bp.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    return jsonify({"success": True, "user": user.to_dict()})
