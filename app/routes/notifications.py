from flask import Blueprint, jsonify, session
from app.extensions import db
from app.models import Notification

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401
        
    notifs = Notification.query.filter_by(userId=user_id).order_by(Notification.createdAt.desc()).all()
    return jsonify({"success": True, "notifications": [n.to_dict() for n in notifs]})

@notifications_bp.route("/api/notifications/read", methods=["POST"])
def mark_notifications_read():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401
        
    unread_notifs = Notification.query.filter_by(userId=user_id, read=False).all()
    for n in unread_notifs:
        n.read = True
    db.session.commit()
            
    return jsonify({"success": True})
