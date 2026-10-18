from flask import Flask, jsonify

from config import Config

from .controllers.auth_controller import auth_controller
from .controllers.city_controller import city_controller
from .controllers.region_controller import region_controller
from .extensions import db, jwt, migrate
from .models.token_block_list import TokenBlockList


def create_app():
    # init app
    app = Flask(__name__)

    # config
    app.config.from_object(Config)

    # init db
    db.init_app(app)

    # init migration
    migrate.init_app(app, db)

    # init jwt
    jwt.init_app(app)

    # add controllers
    app.register_blueprint(region_controller, url_prefix="/api")
    app.register_blueprint(city_controller, url_prefix="/api")
    app.register_blueprint(auth_controller, url_prefix="/api")

    # jwt error handlers

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_data):
        return jsonify({"message": "Token has expired", "error": "expired_token"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify(
            {"message": "Signature verification failed", "error": "invalid_token"}
        ), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify(
            {
                "message": "Request doesn't contain valid token",
                "error": "authorization_token",
            }
        ), 401

    @jwt.token_in_blocklist_loader
    def token_in_blocklist_callback(jwt_header, jwt_data):
        jti = jwt_data["jti"]

        token = (
            db.session.query(TokenBlockList).filter(TokenBlockList.jti == jti).scalar()
        )

        return token is not None

    return app
