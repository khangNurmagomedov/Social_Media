from app.routes.main import main_bp
from app.routes.auth import auth_bp
from app.routes.posts import posts_bp
from app.routes.notifications import notifications_bp

def register_routes(app):
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(notifications_bp)
