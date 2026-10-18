from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import select

from ..extensions import db
from ..models.city import City
from ..models.region import Region

city_controller = Blueprint("city", __name__)


@city_controller.get("/cities")
@city_controller.get("/cities/<int:region_id>")
@jwt_required()
def get_cities(region_id=None):
    try:
        if region_id is None:
            query = select(City)
            all_cities = db.session.execute(query).scalars().all()

            return jsonify(
                [
                    {"id": c.id, "name": c.name, "region_id": c.region_id}
                    for c in all_cities
                ]
            )

        query = select(Region).filter_by(id=region_id)
        region = db.session.execute(query).scalar_one_or_none()

        if not region:
            return jsonify({"error": "Region not found"}), 404

        query = select(City).filter(City.region_id == region_id)
        cities = db.session.execute(query).scalars().all()

        query = select(Region).filter(Region.parent_id == region_id)
        sub_regions = db.session.execute(query).scalars().all()

        data = {
            "cities": [
                {"id": p.id, "name": p.name, "region_id": p.region_id} for p in cities
            ],
            "sub_regions": [
                {"id": g.id, "name": g.name, "parent_id": g.parent_id}
                for g in sub_regions
            ],
        }

        if cities or sub_regions:
            return jsonify(data)
        else:
            return jsonify(
                {"message": "No cities or sub-regions found for this region"}
            ), 404
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@city_controller.post("/city")
@jwt_required()
def add_city():
    try:
        data = request.get_json()

        if not data or "name" not in data or "region_id" not in data:
            return jsonify({"error": "Bad Request"}), 400

        if data["region_id"] is None:
            return jsonify({"error": "Bad Request"}), 400

        parent = db.session.get(Region, data["region_id"])

        if not parent:
            return jsonify({"error": "Region not found"}), 404

        city = City(name=data["name"], region_id=data["region_id"])

        db.session.add(city)

        db.session.commit()

        return jsonify(
            {"id": city.id, "name": city.name, "region_id": city.region_id}
        ), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@city_controller.put("/city/<int:id>")
@jwt_required()
def update_city(id):
    try:
        city = db.session.get(City, id)

        if not city:
            return jsonify({"error": "Not found"}), 404

        data = request.get_json()

        if not data:
            return jsonify({"error": "Bad Request"}), 400

        if "region_id" in data and "name" in data:
            if data["region_id"] is None:
                return jsonify({"error": "Bad Request"}), 400

            parent = db.session.get(Region, data["region_id"])

            if not parent:
                return jsonify({"error": "Region not found"}), 404

            city.name = data["name"]
            city.region_id = data["region_id"]

        db.session.commit()

        return jsonify(
            {"id": city.id, "name": city.name, "region_id": city.region_id}
        ), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@city_controller.delete("/city/<int:id>")
@jwt_required()
def delete_city(id):
    try:
        city = db.session.get(City, id)

        if not city:
            return jsonify({"error": "Not found"}), 404

        db.session.delete(city)

        db.session.commit()

        return jsonify({"message": "The item was successfully deleted"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
