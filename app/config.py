import os

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "chuyen-doi-secret-key-cua-ban-o-day")
    
    db_url = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'social_media.db')}")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")