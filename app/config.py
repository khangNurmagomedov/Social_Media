import os

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

# 1. Định nghĩa đường dẫn các thư mục cần thiết
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# 2. Tự động tạo thư mục nếu chưa tồn tại trên server Render
os.makedirs(INSTANCE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "chuyen-doi-secret-key-cua-ban-o-day")

    db_url = os.getenv(
        "DATABASE_URL", f"sqlite:///{os.path.join(INSTANCE_DIR, 'social_media.db')}"
    )

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = UPLOAD_DIR
