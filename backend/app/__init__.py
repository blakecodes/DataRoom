from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.db import SessionLocal
from app.errors import register_error_handlers


def create_app(config: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config)

    # CORS — explicit origin + credentials so the refresh cookie is allowed.
    CORS(
        app,
        resources={r"/api/*": {"origins": [config.FRONTEND_ORIGIN]}},
        supports_credentials=True,
    )

    register_error_handlers(app)

    # Blueprints (all under /api).
    from app.blueprints.auth import bp as auth_bp
    from app.blueprints.files import bp as files_bp
    from app.blueprints.folders import bp as folders_bp
    from app.blueprints.google_oauth import bp as google_bp
    from app.blueprints.health import bp as health_bp
    from app.blueprints.imports import bp as imports_bp

    for bp in (health_bp, auth_bp, google_bp, files_bp, folders_bp, imports_bp):
        app.register_blueprint(bp, url_prefix="/api")

    @app.teardown_appcontext
    def remove_session(exception=None):  # noqa: ANN001
        SessionLocal.remove()

    return app
