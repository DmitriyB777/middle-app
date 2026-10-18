"""Unit tests for the SQLAlchemy model schemas.

Every assertion reads ``Model.__table__`` (the in-memory SQLAlchemy metadata),
so these tests need neither an app context nor a database connection.
"""

from __future__ import annotations

import pytest

from app.models.city import City
from app.models.region import Region
from app.models.token_block_list import TokenBlockList
from app.models.user import User

pytestmark = pytest.mark.unit


def _primary_key_columns(model):
    """Return the set of primary-key column names for ``model``."""
    return {column.name for column in model.__table__.primary_key}


def test_region_has_id_primary_key():
    assert _primary_key_columns(Region) == {"id"}


def test_city_has_id_primary_key():
    assert _primary_key_columns(City) == {"id"}


def test_user_has_id_primary_key():
    assert _primary_key_columns(User) == {"id"}


def test_token_block_list_has_id_primary_key():
    assert _primary_key_columns(TokenBlockList) == {"id"}


def test_region_name_is_unique_and_not_null():
    column = Region.__table__.c.name
    assert column.unique is True
    assert column.nullable is False


def test_region_parent_id_is_nullable():
    assert Region.__table__.c.parent_id.nullable is True


def test_region_parent_id_has_foreign_key_to_region_id():
    foreign_keys = {
        fk.target_fullname for fk in Region.__table__.c.parent_id.foreign_keys
    }
    assert foreign_keys == {"region.id"}


def test_region_parent_id_is_indexed():
    assert Region.__table__.c.parent_id.index is True


def test_city_name_is_unique_and_not_null():
    column = City.__table__.c.name
    assert column.unique is True
    assert column.nullable is False


def test_city_region_id_has_foreign_key_to_region_id():
    foreign_keys = {
        fk.target_fullname for fk in City.__table__.c.region_id.foreign_keys
    }
    assert foreign_keys == {"region.id"}


def test_user_username_is_unique_and_not_null():
    column = User.__table__.c.username
    assert column.unique is True
    assert column.nullable is False


def test_user_password_is_not_null():
    assert User.__table__.c.password.nullable is False


def test_token_block_list_jti_is_unique_and_not_null():
    column = TokenBlockList.__table__.c.jti
    assert column.unique is True
    assert column.nullable is False


def test_token_block_list_create_at_has_default():
    assert TokenBlockList.__table__.c.create_at.default is not None
