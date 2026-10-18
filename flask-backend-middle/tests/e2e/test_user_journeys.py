"""End-to-end user journeys through the public HTTP API.

Unlike integration tests, every test here chains many endpoint calls and
verifies that state is consistent *across* endpoints.  Everything runs against
the Flask test client on the in-memory SQLite database provided by the shared
``app`` / ``client`` fixtures, so no real network or PostgreSQL is involved.
"""

from __future__ import annotations

import pytest

from tests.fixtures.data import MOCK_PASSWORD, mock_region_tree

pytestmark = pytest.mark.e2e

PROTECTED_PATHS = ["/api/regions", "/api/cities"]


def _auth(token: str) -> dict[str, str]:
    """Return an ``Authorization: Bearer`` header mapping for ``token``."""
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(
    client, username: str, password: str = MOCK_PASSWORD
) -> tuple[str, str]:
    """Register ``username`` then log in, returning ``(access, refresh)``."""
    register_response = client.post(
        "/api/register", json={"username": username, "password": password}
    )
    assert register_response.status_code == 201, register_response.get_json()
    assert register_response.get_json() == {"message": "User was created"}

    login_response = client.post(
        "/api/login", json={"username": username, "password": password}
    )
    assert login_response.status_code == 200, login_response.get_json()
    tokens = login_response.get_json()["tokens"]
    return tokens["access"], tokens["refresh"]


def _build_region_tree(client, headers, tree) -> dict[str, int]:
    """Materialise a name/parent tree via ``POST /api/region``.

    Nodes are posted in list order so a parent always exists before its
    children; the return value maps each region name to its generated id.
    """
    ids: dict[str, int] = {}
    for node in tree:
        parent_id = ids[node["parent"]] if node["parent"] is not None else None
        response = client.post(
            "/api/region",
            json={"name": node["name"], "parent_id": parent_id},
            headers=headers,
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["name"] == node["name"]
        assert body["parent_id"] == parent_id
        ids[node["name"]] = body["id"]
    return ids


def _create_city(client, headers, name: str, region_id: int) -> dict:
    """Create a city via ``POST /api/city`` and return its JSON body."""
    response = client.post(
        "/api/city",
        json={"name": name, "region_id": region_id},
        headers=headers,
    )
    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    assert body["name"] == name
    assert body["region_id"] == region_id
    return body


def _get_json(client, path: str, headers) -> object:
    """GET ``path`` expecting 200 and return the decoded JSON body."""
    response = client.get(path, headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def test_full_region_city_lifecycle(client):
    # given an authenticated user registered through the API
    access, _refresh = _register_and_login(client, username="tree-e2e")
    headers = _auth(access)

    # when the nested region tree is materialised parent-first
    region_ids = _build_region_tree(client, headers, mock_region_tree())
    europe_id = region_ids["Europe"]
    germany_id = region_ids["Germany"]
    bavaria_id = region_ids["Bavaria"]
    france_id = region_ids["France"]

    # and cities are attached to selected regions
    berlin = _create_city(client, headers, "Berlin", germany_id)
    _create_city(client, headers, "Munich", germany_id)
    _create_city(client, headers, "Paris", france_id)
    _create_city(client, headers, "Nuremberg", bavaria_id)

    # then GET /regions exposes the whole tree with resolved parent ids
    regions = _get_json(client, "/api/regions", headers)
    assert {r["name"] for r in regions} == {
        "Europe",
        "Germany",
        "Bavaria",
        "France",
    }
    by_name = {r["name"]: r for r in regions}
    assert by_name["Europe"]["parent_id"] is None
    assert by_name["Germany"]["parent_id"] == europe_id
    assert by_name["Bavaria"]["parent_id"] == germany_id
    assert by_name["France"]["parent_id"] == europe_id

    # and GET /cities lists every city against its region
    cities = _get_json(client, "/api/cities", headers)
    assert {c["name"]: c["region_id"] for c in cities} == {
        "Berlin": germany_id,
        "Munich": germany_id,
        "Paris": france_id,
        "Nuremberg": bavaria_id,
    }

    # and GET /cities/<germany> returns Bavaria as a sub-region plus its cities
    germany_view = _get_json(client, f"/api/cities/{germany_id}", headers)
    assert {s["name"] for s in germany_view["sub_regions"]} == {"Bavaria"}
    assert {c["name"] for c in germany_view["cities"]} == {"Berlin", "Munich"}

    # when a region is renamed while keeping its parent
    region_update = client.put(
        f"/api/region/{france_id}",
        json={"name": "French Republic", "parent_id": europe_id},
        headers=headers,
    )
    assert region_update.status_code == 200, region_update.get_json()
    assert region_update.get_json() == {
        "id": france_id,
        "name": "French Republic",
        "parent_id": europe_id,
    }

    # and a city is renamed and moved to a different region
    city_update = client.put(
        f"/api/city/{berlin['id']}",
        json={"name": "Berlin City", "region_id": bavaria_id},
        headers=headers,
    )
    assert city_update.status_code == 200, city_update.get_json()
    assert city_update.get_json() == {
        "id": berlin["id"],
        "name": "Berlin City",
        "region_id": bavaria_id,
    }

    # then subsequent reads reflect both mutations
    regions = _get_json(client, "/api/regions", headers)
    assert {r["name"] for r in regions} == {
        "Europe",
        "Germany",
        "Bavaria",
        "French Republic",
    }
    germany_view = _get_json(client, f"/api/cities/{germany_id}", headers)
    assert {c["name"] for c in germany_view["cities"]} == {"Munich"}
    bavaria_view = _get_json(client, f"/api/cities/{bavaria_id}", headers)
    assert {c["name"] for c in bavaria_view["cities"]} == {
        "Berlin City",
        "Nuremberg",
    }

    # when the root region is deleted, the whole subtree cascades
    deletion = client.delete(f"/api/region/{europe_id}", headers=headers)
    assert deletion.status_code == 200, deletion.get_json()
    assert deletion.get_json() == {"message": "The item was successfully deleted"}

    # then every descendant region and its cities are gone
    assert _get_json(client, "/api/regions", headers) == []
    assert _get_json(client, "/api/cities", headers) == []
    assert client.get(f"/api/cities/{germany_id}", headers=headers).status_code == 404


def test_auth_lifecycle_and_token_revocation(client):
    # given a freshly registered user with an access/refresh token pair
    access, refresh = _register_and_login(client, username="auth-e2e")
    access_headers = _auth(access)
    refresh_headers = _auth(refresh)

    # the access token authorises a protected endpoint
    assert client.get("/api/regions", headers=access_headers).status_code == 200

    # when the refresh token is exchanged for a brand new access token
    refreshed = client.get("/api/refresh", headers=refresh_headers)
    assert refreshed.status_code == 200, refreshed.get_json()
    new_access = refreshed.get_json()["access_token"]
    assert new_access != access

    # then the new access token also works
    assert client.get("/api/regions", headers=_auth(new_access)).status_code == 200

    # when the original access token is logged out
    access_logout = client.get("/api/logout", headers=access_headers)
    assert access_logout.status_code == 200, access_logout.get_json()
    assert access_logout.get_json() == {"message": "access token revoked successfully"}

    # then the revoked access token is rejected on a protected endpoint
    revoked = client.get("/api/regions", headers=access_headers)
    assert revoked.status_code == 401
    assert revoked.get_json() == {"msg": "Token has been revoked"}

    # while the refresh token is still usable after an access-token logout
    still_valid = client.get("/api/refresh", headers=refresh_headers)
    assert still_valid.status_code == 200, still_valid.get_json()

    # when the refresh token is itself logged out
    refresh_logout = client.get("/api/logout", headers=refresh_headers)
    assert refresh_logout.status_code == 200, refresh_logout.get_json()
    assert refresh_logout.get_json() == {
        "message": "refresh token revoked successfully"
    }

    # then it is rejected afterwards too
    rejected = client.get("/api/refresh", headers=refresh_headers)
    assert rejected.status_code == 401
    assert rejected.get_json() == {"msg": "Token has been revoked"}


def test_error_flow_end_to_end(client):
    # given a valid user and access token
    access, _refresh = _register_and_login(client, username="error-e2e")
    headers = _auth(access)

    # when protected endpoints are called without a token
    for path in PROTECTED_PATHS:
        unauthenticated = client.get(path)
        assert unauthenticated.status_code == 401
        assert unauthenticated.get_json() == {
            "message": "Request doesn't contain valid token",
            "error": "authorization_token",
        }

    # including writes as well as reads
    unauthenticated_write = client.post(
        "/api/region", json={"name": "Ghost", "parent_id": None}
    )
    assert unauthenticated_write.status_code == 401
    assert unauthenticated_write.get_json() == {
        "message": "Request doesn't contain valid token",
        "error": "authorization_token",
    }

    # when the same username is registered twice
    duplicate = client.post(
        "/api/register", json={"username": "error-e2e", "password": MOCK_PASSWORD}
    )
    # then the second attempt conflicts
    assert duplicate.status_code == 409
    assert duplicate.get_json() == {"error": "User already exists"}

    # when logging in with the wrong password
    bad_login = client.post(
        "/api/login", json={"username": "error-e2e", "password": "wrong-password"}
    )
    # then the credentials are rejected
    assert bad_login.status_code == 400
    assert bad_login.get_json() == {"error": "Invalid username or password"}

    # when creating a region without a body
    empty_region = client.post("/api/region", json={}, headers=headers)
    # then it is a bad request
    assert empty_region.status_code == 400
    assert empty_region.get_json() == {"error": "Bad Request"}

    # when creating a city in a non-existent region
    unknown_city = client.post(
        "/api/city",
        json={"name": "Nowhere", "region_id": 999999},
        headers=headers,
    )
    # then the region lookup fails
    assert unknown_city.status_code == 404
    assert unknown_city.get_json() == {"error": "Region not found"}

    # when updating or deleting resources that do not exist
    region_update = client.put(
        "/api/region/999999",
        json={"name": "Ghost", "parent_id": None},
        headers=headers,
    )
    region_delete = client.delete("/api/region/999999", headers=headers)
    city_update = client.put(
        "/api/city/999999",
        json={"name": "Ghost", "region_id": 1},
        headers=headers,
    )
    city_delete = client.delete("/api/city/999999", headers=headers)

    # then every one of them reports 404 Not found
    for response in (region_update, region_delete, city_update, city_delete):
        assert response.status_code == 404
        assert response.get_json() == {"error": "Not found"}
