"""Integration tests for the city HTTP endpoints.

Covers listing, creation, the per-region aggregate view (cities +
sub-regions), updates and deletion.
"""

from __future__ import annotations

import pytest

from app.models.city import City
from tests.fixtures.data import mock_city_payload

pytestmark = pytest.mark.integration


def _list_cities(client, headers):
    response = client.get("/api/cities", headers=headers)
    assert response.status_code == 200
    return response.get_json()


def test_list_cities_empty_then_populated(client, auth_headers, make_region, make_city):
    assert _list_cities(client, auth_headers) == []

    region = make_region(name="Germany")
    city = make_city(name="Berlin", region_id=region.id)

    assert _list_cities(client, auth_headers) == [
        {"id": city.id, "name": "Berlin", "region_id": region.id}
    ]


def test_create_city_returns_201(client, auth_headers, make_region):
    region = make_region(name="Germany")
    payload = mock_city_payload(name="Berlin", region_id=region.id)

    response = client.post("/api/city", json=payload, headers=auth_headers)

    assert response.status_code == 201
    body = response.get_json()
    assert body["name"] == "Berlin"
    assert body["region_id"] == region.id
    assert isinstance(body["id"], int)


def test_create_city_missing_fields_returns_400(client, auth_headers):
    response = client.post("/api/city", json={"name": "Berlin"}, headers=auth_headers)

    assert response.status_code == 400
    assert response.get_json() == {"error": "Bad Request"}


def test_create_city_with_missing_region_returns_404(client, auth_headers):
    payload = mock_city_payload(name="Atlantis", region_id=999999)

    response = client.post("/api/city", json=payload, headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {"error": "Region not found"}


def test_get_cities_for_region_returns_cities_and_sub_regions(
    client, auth_headers, make_region, make_city
):
    parent = make_region(name="Europe")
    child = make_region(name="Germany", parent_id=parent.id)
    parent_city = make_city(name="Paris", region_id=parent.id)
    make_city(name="Berlin", region_id=child.id)

    response = client.get(f"/api/cities/{parent.id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {
        "cities": [{"id": parent_city.id, "name": "Paris", "region_id": parent.id}],
        "sub_regions": [{"id": child.id, "name": "Germany", "parent_id": parent.id}],
    }


def test_get_cities_nonexistent_region_returns_404(client, auth_headers):
    response = client.get("/api/cities/999999", headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {"error": "Region not found"}


def test_get_cities_region_without_children_returns_404(
    client, auth_headers, make_region
):
    region = make_region(name="Emptyland")

    response = client.get(f"/api/cities/{region.id}", headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {
        "message": "No cities or sub-regions found for this region"
    }


def test_update_city_returns_200(client, auth_headers, make_region, make_city):
    region = make_region(name="Germany")
    other_region = make_region(name="France")
    city = make_city(name="Berlin", region_id=region.id)

    response = client.put(
        f"/api/city/{city.id}",
        json={"name": "Munich", "region_id": other_region.id},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "id": city.id,
        "name": "Munich",
        "region_id": other_region.id,
    }


def test_update_city_with_bad_region_returns_404(
    client, auth_headers, make_region, make_city
):
    region = make_region(name="Germany")
    city = make_city(name="Berlin", region_id=region.id)

    response = client.put(
        f"/api/city/{city.id}",
        json={"name": "Munich", "region_id": 999999},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": "Region not found"}


def test_update_city_nonexistent_returns_404(client, auth_headers):
    response = client.put(
        "/api/city/999999",
        json={"name": "Munich", "region_id": 1},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": "Not found"}


def test_delete_city_returns_200_then_gone(
    client, auth_headers, make_region, make_city, db_session
):
    region = make_region(name="Germany")
    city = make_city(name="Berlin", region_id=region.id)

    response = client.delete(f"/api/city/{city.id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json() == {"message": "The item was successfully deleted"}

    assert _list_cities(client, auth_headers) == []
    assert db_session.get(City, city.id) is None


def test_delete_city_missing_returns_404(client, auth_headers):
    response = client.delete("/api/city/999999", headers=auth_headers)

    assert response.status_code == 404
    assert response.get_json() == {"error": "Not found"}
