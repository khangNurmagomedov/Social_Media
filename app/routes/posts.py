import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, session
import cloudinary.uploader
from app.extensions import db
from app.models import User, Post, Like, Notification

posts_bp = Blueprint("posts", __name__)


@posts_bp.route("/api/photos", methods=["POST"])
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

    # Upload ảnh lên Cloudinary thay vì lưu xuống ổ đĩa
    public_id = f"social_media/{uuid.uuid4().hex}"
    upload_result = cloudinary.uploader.upload(
        file, public_id=public_id, overwrite=True, resource_type="image"
    )
    image_url = upload_result["secure_url"]

    new_post = Post(
        imageUrl=image_url,
        caption=caption,
        senderName=current_user.name,
        senderAvatar=current_user.avatar,
        userId=current_user.id,
        createdAt=datetime.now().isoformat(),
    )
    db.session.add(new_post)
    db.session.commit()

    return jsonify({"success": True, "photo": new_post.to_dict()})


@posts_bp.route("/api/photos", methods=["GET"])
def get_photos():
    posts = Post.query.order_by(Post.createdAt.desc()).all()
    return jsonify({"success": True, "photos": [p.to_dict() for p in posts]})


@posts_bp.route("/api/photos/<photo_id>/like", methods=["POST"])
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

        # Also delete the notification so the post owner won't see it
        old_notif = Notification.query.filter_by(
            senderId=user_id,
            photoId=photo_id,
            type="like",
        ).first()
        if old_notif:
            db.session.delete(old_notif)
    else:
        new_like = Like(
            post_id=photo_id,
            user_id=user_id,
            user_name=current_user.name,
            user_avatar=current_user.avatar,
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
                createdAt=datetime.now().isoformat(),
            )
            db.session.add(notif)

    db.session.commit()

    # Reload post to get updated likes
    return jsonify({"success": True, "likes": post.to_dict()["likes"]})


@posts_bp.route("/api/photos/<photo_id>", methods=["DELETE"])
def delete_photo(photo_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Chưa đăng nhập!"}), 401

    post = Post.query.get(photo_id)
    if not post:
        return jsonify({"success": False, "message": "Bài viết không tồn tại!"}), 404

    # Only the post owner can delete
    if post.userId != user_id:
        return jsonify({"success": False, "message": "Bạn không có quyền xóa bài viết này!"}), 403

    # Delete all notifications related to this post
    Notification.query.filter_by(photoId=photo_id).delete()

    # Delete image from Cloudinary
    try:
        # Extract public_id from the Cloudinary URL
        # URL format: https://res.cloudinary.com/.../social_media/xxxx.jpg
        url_parts = post.imageUrl.split("/")
        # Find "social_media" segment and build public_id without extension
        if "social_media" in url_parts:
            idx = url_parts.index("social_media")
            filename = url_parts[idx + 1].rsplit(".", 1)[0]  # remove extension
            public_id = f"social_media/{filename}"
            cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception:
        pass  # Don't block deletion if Cloudinary cleanup fails

    # Delete the post (likes are cascade-deleted automatically)
    db.session.delete(post)
    db.session.commit()

    return jsonify({"success": True, "message": "Đã xóa bài viết!"})
