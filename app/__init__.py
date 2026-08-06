import os
from flask import Flask
from app.config import Config
from app.extensions import db
from app.routes import register_routes

def create_app(config_class=Config):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(config_class)

    # Khởi tạo extensions
    db.init_app(app)

    # Tạo thư mục uploads nếu chưa tồn tại
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Đăng ký các routes/blueprints
    register_routes(app)

    # Đảm bảo các bảng cơ sở dữ liệu được tạo
    with app.app_context():
        db.create_all()

    return app
