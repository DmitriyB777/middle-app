"""Integration tests for the authentication HTTP endpoints.

These tests drive the real Flask test client (registration, login, token
refresh and logout/blocklist) against the in-memory SQLite database provided by
the shared ``app`` / ``client`` fixtures.
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.integration


def test_register_returns_201(client, sample_user_data):
    response = client.post("/api/register", json=sample_user_data)

    assert response.status_code == 201
    assert response.get_json() == {"message": "User was created"}


def test_register_missing_fields_returns_400(client):
    response = client.post("/api/register", json={"username": "onlyuser"})

    assert response.status_code == 400
    assert response.get_json() == {"error": "Bad Request"}


def test_register_duplicate_username_returns_409(client, registered_user):
    response = client.post("/api/register", json=registered_user)

    assert response.status_code == 409
    assert response.get_json() == {"error": "User already exists"}


def test_login_returns_access_and_refresh_tokens(client, registered_user):
    response = client.post("/api/login", json=registered_user)

    assert response.status_code == 200
    body = response.get_json()
    assert body["message"] == "Logged In "
    tokens = body["tokens"]
    assert tokens["access"]
    assert tokens["refresh"]
    assert tokens["access"] != tokens["refresh"]


def test_login_wrong_password_returns_400(client, registered_user):
    payload = {
        "username": registered_user["username"],
        "password": "definitely-wrong-password",
    }

    response = client.post("/api/login", json=payload)

    assert response.status_code == 400
    assert response.get_json() == {"error": "Invalid username or password"}


def test_protected_endpoint_without_token_returns_401(client):
    response = client.get("/api/regions")

    assert response.status_code == 401
    assert response.get_json() == {
        "message": "Request doesn't contain valid token",
        "error": "authorization_token",
    }


def test_refresh_with_refresh_token_returns_usable_access_token(
    client, refresh_headers
):
    response = client.get("/api/refresh", headers=refresh_headers)

    assert response.status_code == 200
    new_access = response.get_json()["access_token"]
    assert new_access

    protected = client.get(
        "/api/regions", headers={"Authorization": f"Bearer {new_access}"}
    )
    assert protected.status_code == 200
    assert protected.get_json() == []


def test_refresh_with_access_token_returns_401(client, auth_headers):
    response = client.get("/api/refresh", headers=auth_headers)

    assert response.status_code == 401
    assert response.get_json()["error"] == "invalid_token"


def test_logout_blocks_access_token(client, auth_headers):
    logout = client.get("/api/logout", headers=auth_headers)

    assert logout.status_code == 200
    assert logout.get_json() == {"message": "access token revoked successfully"}

    protected = client.get("/api/regions", headers=auth_headers)
    assert protected.status_code == 401
    # The app overrides ``invalid_token_loader`` but not ``revoked_token_loader``,
    # so a blocklisted token yields flask-jwt-extended's default body/error key.
    assert protected.get_json() == {"msg": "Token has been revoked"}
