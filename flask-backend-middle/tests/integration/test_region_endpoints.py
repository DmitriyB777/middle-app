"""Integration tests for the region HTTP endpoints.

Covers listing, creation, updates (including the parent/descendant guards) and
the recursive delete that cascades to descendant regions and their cities.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models.city import City
from app.models.region import Region
from tests.fixtures.data import mock_region_payload

pytestmark = pytest.mark.integration


def _list_regions(client, headers):
    response = client.get("/api/regions", headers=headers)
    assert response.status_code == 200
    return response.get_json()


def test_list_regions_empty_then_populated(client, auth_headers, make_region):
    assert _list_regions(client, auth_headers) == []

    region = make_region(name="Europe")

    regions = _list_regions(client, auth_headers)
    assert regions == [{"id": region.id, "name": "Europe", "parent_id": None}]


def test_create_region_returns_201(client, auth_headers, sample_region_data):
    response = client.post("/api/region", json=sample_region_data, headers=auth_headers)

    assert response.status_code == 201
    body = response.get_json()
    assert body["name"] == sample_region_data["name"]
    assert body["parent_id"] is None
    assert isinstance(body["id"], int)

    regions = _list_regions(client, auth_headers)
    assert regions == [
        {"id": body["id"], "name": sample_region_data["name"], "parent_id": None}
    ]


def test_create_region_missing_fields_returns_400(client, auth_headers):
    response = client.post("/api/region", json={"name": "Europe"}, headers=auth_headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": "Bad Request"}


def test_create_region_with_missing_parent_returns_404(client, auth_headers):
    payload = mock_region_payload(name="Atlantis", parent_id=999999)

    response = client.post("/api/region", json=payload, headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {"error": "Parent region not found"}


def test_create_child_region_returns_201(client, auth_headers, make_region):
    parent = make_region(name="Europe")
    payload = mock_region_payload(name="Germany", parent_id=parent.id)

    response = client.post("/api/region", json=payload, headers=auth_headers)

    assert response.status_code == 201
    body = response.get_json()
    assert body["name"] == "Germany"
    assert body["parent_id"] == parent.id


def test_update_region_name_and_parent(client, auth_headers, make_region):
    region = make_region(name="Europe")

    response = client.put(
        f"/api/region/{region.id}",
        json={"name": "Eurasia", "parent_id": None},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "id": region.id,
        "name": "Eurasia",
        "parent_id": None,
    }

    regions = _list_regions(client, auth_headers)
    assert regions == [{"id": region.id, "name": "Eurasia", "parent_id": None}]


def test_update_region_self_parent_returns_400(client, auth_headers, make_region):
    region = make_region(name="Europe")

    response = client.put(
        f"/api/region/{region.id}",
        json={"name": "Europe", "parent_id": region.id},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "A region cannot be its own parent"}


def test_update_region_under_own_descendant_returns_400(
    client, auth_headers, make_region
):
    parent = make_region(name="Europe")
    child = make_region(name="Germany", parent_id=parent.id)

    response = client.put(
        f"/api/region/{parent.id}",
        json={"name": "Europe", "parent_id": child.id},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Cannot move a region to one of its own descendants"
    }


def test_update_region_nonexistent_returns_404(client, auth_headers):
    response = client.put(
        "/api/region/999999",
        json={"name": "Ghost", "parent_id": None},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": "Not found"}


def test_delete_region_missing_returns_404(client, auth_headers):
    response = client.delete("/api/region/999999", headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {"error": "Not found"}


def test_delete_region_cascades_descendants_and_cities(
    client, auth_headers, make_region, make_city, db_session
):
    root = make_region(name="Root")
    child = make_region(name="Child", parent_id=root.id)
    grandchild = make_region(name="Grandchild", parent_id=child.id)
    make_city(name="RootCity", region_id=root.id)
    make_city(name="ChildCity", region_id=child.id)
    make_city(name="GrandCity", region_id=grandchild.id)

    response = client.delete(f"/api/region/{root.id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {"message": "The item was successfully deleted"}

    assert _list_regions(client, auth_headers) == []
    region_count = db_session.execute(
        select(func.count()).select_from(Region)
    ).scalar_one()
    city_count = db_session.execute(select(func.count()).select_from(City)).scalar_one()
    assert region_count == 0
    assert city_count == 0
