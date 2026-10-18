from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy import select
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models.token_block_list import TokenBlockList
from ..models.user import User

auth_controller = Blueprint("auth", __name__)


@auth_controller.post("/register")
def register():
    try:
        data = request.get_json()

        if not data or "username" not in data or "password" not in data:
            return jsonify({"error": "Bad Request"}), 400

        query = select(User).filter_by(username=data["username"])

        user = db.session.execute(query).scalar_one_or_none()

        if user is not None:
            return jsonify({"error": "User already exists"}), 409

        user = User(
            username=data["username"], password=generate_password_hash(data["password"])
        )

        db.session.add(user)

        db.session.commit()

        return jsonify({"message": "User was created"}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@auth_controller.post("/login")
def login():
    try:
        data = request.get_json()

        query = select(User).filter_by(username=data["username"])

        user = db.session.execute(query).scalar_one_or_none()

        if user and check_password_hash(user.password, data["password"]):
            token_access = create_access_token(user.username)
            token_refresh = create_refresh_token(user.username)

            return jsonify(
                {
                    "message": "Logged In ",
                    "tokens": {"access": token_access, "refresh": token_refresh},
                }
            ), 200

        return jsonify({"error": "Invalid username or password"}), 400
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@auth_controller.get("/refresh")
@jwt_required(refresh=True)
def refresh():
    try:
        identity = get_jwt_identity()

        access_token = create_access_token(identity=identity)

        return jsonify({"access_token": access_token})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@auth_controller.get("/logout")
@jwt_required(verify_type=False)
def logout():
    try:
        jwt = get_jwt()

        jti = jwt["jti"]

        token_type = jwt["type"]

        token_block_list = TokenBlockList(jti=jti)

        db.session.add(token_block_list)

        db.session.commit()

        return jsonify({"message": f"{token_type} token revoked successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
