"""Shared pytest fixtures for the Flask backend test suite.

The fixtures below form the contract used by the unit, integration and e2e
test modules:

* ``app`` / ``client`` / ``db_session`` expose the application and database.
* ``sample_*`` fixtures return fresh mock payloads.
* ``registered_user`` / ``access_token`` / ``refresh_token`` / ``*_headers``
  drive the auth flow through the real HTTP layer.
* ``make_user`` / ``make_region`` / ``make_city`` are factories that persist
  model instances directly.
"""

from __future__ import annotations

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from werkzeug.security import generate_password_hash

import config as config_module
from app import create_app
from app.extensions import db
from app.models.city import City
from app.models.region import Region
from app.models.user import User

from .fixtures.data import (
    mock_city_payload,
    mock_region_payload,
    mock_region_tree,
    mock_user_payload,
)

SQLITE_URI = "sqlite:///:memory:"
TEST_JWT_SECRET = "test-jwt-secret-key-0123456789abcdef"


def _make_metadata_sqlite_compatible(metadata):
    """Replace PostgreSQL-only column types with generic SQLAlchemy ones.

    ``TokenBlockList.jti`` uses ``postgresql.UUID``, which does not compile on
    SQLite and would break ``db.create_all()``.  Swapping it for the generic
    ``sqlalchemy.Uuid`` lets the DDL compile.  ``as_uuid=False`` is required
    because the JWT ``jti`` is a plain string: with ``as_uuid=True`` the generic
    type's bind processing calls ``value.hex`` and raises on strings, breaking
    both the logout insert and the token-blocklist lookup.
    """
    for table in metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = sa.Uuid(as_uuid=False)


@pytest.fixture()
def app(monkeypatch):
    """Return a Flask app configured for tests with an in-memory SQLite DB.

    ``Config`` is patched *before* ``create_app()`` because Flask-SQLAlchemy
    builds its engine eagerly during ``init_app``; updating ``app.config``
    afterwards would leave the original PostgreSQL engine in place.  The
    metadata is patched for SQLite, all tables are created, and everything is
    torn down (session removed, tables dropped) after the test.
    """
    monkeypatch.setattr(config_module.Config, "SQLALCHEMY_DATABASE_URI", SQLITE_URI)
    monkeypatch.setattr(config_module.Config, "JWT_SECRET_KEY", TEST_JWT_SECRET)

    app = create_app()
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=SQLITE_URI,
        JWT_SECRET_KEY=TEST_JWT_SECRET,
    )

    _make_metadata_sqlite_compatible(db.metadata)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    """Return a Flask test client bound to the ``app`` fixture."""
    return app.test_client()


@pytest.fixture()
def db_session(app):
    """Yield the SQLAlchemy session inside the active app context."""
    yield db.session


@pytest.fixture()
def sample_user_data():
    """Return a fresh ``{"username", "password"}`` registration payload."""
    return mock_user_payload()


@pytest.fixture()
def sample_region_data():
    """Return a fresh ``{"name", "parent_id"}`` region payload."""
    return mock_region_payload()


@pytest.fixture()
def sample_city_data():
    """Return a fresh ``{"name", "region_id"}`` city payload."""
    return mock_city_payload()


@pytest.fixture()
def region_tree_data():
    """Return a fresh nested region-tree spec (see ``mock_region_tree``)."""
    return mock_region_tree()


@pytest.fixture()
def registered_user(client, sample_user_data):
    """Register ``sample_user_data`` via ``POST /api/register`` and return it."""
    response = client.post("/api/register", json=sample_user_data)
    assert response.status_code == 201
    return sample_user_data


@pytest.fixture()
def access_token(client, registered_user, sample_user_data):
    """Log in the registered user and return the access token string."""
    response = client.post("/api/login", json=sample_user_data)
    assert response.status_code == 200
    return response.get_json()["tokens"]["access"]


@pytest.fixture()
def refresh_token(client, registered_user, sample_user_data):
    """Log in the registered user and return the refresh token string."""
    response = client.post("/api/login", json=sample_user_data)
    assert response.status_code == 200
    return response.get_json()["tokens"]["refresh"]


@pytest.fixture()
def auth_headers(access_token):
    """Return ``{"Authorization": "Bearer <access_token>"}``."""
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture()
def refresh_headers(refresh_token):
    """Return ``{"Authorization": "Bearer <refresh_token>"}``."""
    return {"Authorization": f"Bearer {refresh_token}"}


@pytest.fixture()
def make_user(db_session):
    """Return a factory that creates and commits a ``User``.

    ``make_user(username="u", password="p")`` stores a hashed password and
    returns the persisted ``User`` instance.
    """

    def _make_user(username="u", password="p"):
        user = User(username=username, password=generate_password_hash(password))
        db_session.add(user)
        db_session.commit()
        return user

    return _make_user


@pytest.fixture()
def make_region(db_session):
    """Return a factory that creates and commits a ``Region``.

    ``make_region(name="X", parent_id=None)`` returns the persisted instance.
    """

    def _make_region(name="X", parent_id=None):
        region = Region(name=name, parent_id=parent_id)
        db_session.add(region)
        db_session.commit()
        return region

    return _make_region


@pytest.fixture()
def make_city(db_session):
    """Return a factory that creates and commits a ``City``.

    ``make_city(name="X", region_id=...)`` returns the persisted instance.
    """

    def _make_city(name="X", region_id=None):
        city = City(name=name, region_id=region_id)
        db_session.add(city)
        db_session.commit()
        return city

    return _make_city
