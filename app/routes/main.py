from flask import Blueprint, render_template, redirect, url_for, session, send_from_directory, current_app
from app.models import User

main_bp = Blueprint('main', __name__)

@main_bp.route('/', endpoint='index')
def index():
    if "user_id" not in session:
        return redirect(url_for("main.login_page"))
    user = User.query.get(session["user_id"])
    if not user:
        session.pop("user_id", None)
        return redirect(url_for("main.login_page"))
    return render_template("index.html")

@main_bp.route('/login', endpoint='login_page')
def login_page():
    if "user_id" in session:
        user = User.query.get(session["user_id"])
        if user:
            return redirect(url_for("main.index"))
    return render_template("login.html")

@main_bp.route('/uploads/<filename>', endpoint='serve_upload')
def serve_upload(filename):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)
