from flask import jsonify
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    """Raised anywhere in the app to produce a consistent error envelope."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _envelope(code: str, message: str):
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        return jsonify(_envelope(err.code, err.message)), err.status

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        code = (err.name or "error").lower().replace(" ", "_")
        return jsonify(_envelope(code, err.description or err.name)), err.code or 500

    @app.errorhandler(Exception)
    def handle_unexpected(err: Exception):
        app.logger.exception("Unhandled error: %s", err)
        return jsonify(_envelope("internal_error", "Something went wrong.")), 500
