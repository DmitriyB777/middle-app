from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import delete, select

from ..extensions import db
from ..models.city import City
from ..models.region import Region

region_controller = Blueprint("region", __name__)


@region_controller.get("/regions")
@jwt_required()
def get_regions():
    try:
        query = select(Region)
        regions = db.session.execute(query).scalars().all()

        return jsonify(
            [{"id": r.id, "name": r.name, "parent_id": r.parent_id} for r in regions]
        )
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@region_controller.post("/region")
@jwt_required()
def add_region():
    try:
        data = request.get_json()

        if not data or "name" not in data or "parent_id" not in data:
            return jsonify({"error": "Bad Request"}), 400

        if data["parent_id"] is not None:
            parent = db.session.get(Region, data["parent_id"])

            if parent is None:
                return jsonify({"error": "Parent region not found"}), 404

        region = Region(name=data["name"], parent_id=data["parent_id"])

        db.session.add(region)

        db.session.commit()

        return jsonify(
            {"id": region.id, "name": region.name, "parent_id": region.parent_id}
        ), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@region_controller.put("/region/<int:id>")
@jwt_required()
def update_region(id):
    try:
        region = db.session.get(Region, id)

        if not region:
            return jsonify({"error": "Not found"}), 404

        data = request.get_json()

        if not data:
            return jsonify({"error": "Bad Request"}), 400

        if "parent_id" in data and "name" in data:
            if data["parent_id"] == id:
                return jsonify({"error": "A region cannot be its own parent"}), 400

            if data["parent_id"] is not None:
                parent = db.session.get(Region, data["parent_id"])

                if parent is None:
                    return jsonify({"error": "Parent region not found"}), 404

            descendants = get_all_descendant_regions(id)

            if data["parent_id"] in descendants:
                return jsonify(
                    {"error": "Cannot move a region to one of its own descendants"}
                ), 400

            region.name = data["name"]
            region.parent_id = data["parent_id"]

        db.session.commit()

        return jsonify(
            {"id": region.id, "name": region.name, "parent_id": region.parent_id}
        ), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@region_controller.delete("/region/<int:id>")
@jwt_required()
def delete_region(id):
    try:
        region = db.session.get(Region, id)

        if not region:
            return jsonify({"error": "Not found"}), 404

        regions_ids_to_remove = get_all_descendant_regions(region.id)

        query = delete(City).where(City.region_id.in_(regions_ids_to_remove))
        db.session.execute(query)

        query = delete(Region).where(Region.id.in_(regions_ids_to_remove))
        db.session.execute(query)

        db.session.commit()

        return jsonify({"message": "The item was successfully deleted"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


def get_all_descendant_regions(region_id):
    descendant_regions_ids = set()
    regions_to_process = [region_id]

    while regions_to_process:
        current_region_id = regions_to_process.pop()
        descendant_regions_ids.add(current_region_id)

        query = select(Region).filter_by(parent_id=current_region_id)
        subregions = db.session.execute(query).scalars().all()

        for subregion in subregions:
            regions_to_process.append(subregion.id)

    return list(descendant_regions_ids)
