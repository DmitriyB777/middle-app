"""Deterministic mock data shared across the test suite.

Every public function returns a fresh object, so callers can mutate the result
without leaking state into other tests.
"""

from __future__ import annotations

MOCK_PASSWORD = "Secret123!"


def mock_user_payload(
    username: str = "testuser", password: str = MOCK_PASSWORD
) -> dict:
    """Return a fresh registration/login payload: ``{"username", "password"}``."""
    return {"username": username, "password": password}


def mock_region_payload(name: str = "Europe", parent_id: int | None = None) -> dict:
    """Return a fresh region payload: ``{"name", "parent_id"}``."""
    return {"name": name, "parent_id": parent_id}


def mock_city_payload(name: str = "Berlin", region_id: int | None = None) -> dict:
    """Return a fresh city payload: ``{"name", "region_id"}``."""
    return {"name": name, "region_id": region_id}


def mock_region_tree() -> list[dict]:
    """Return a fresh, deterministic region-tree specification.

    The tree is a flat list of nodes in creation order.  Each node is a dict::

        {"name": "Europe", "parent": None}

    ``parent`` is the ``name`` of the parent node, or ``None`` for a root.
    To materialise the tree, create nodes in list order and map each name to
    its generated id::

        ids = {}
        for node in mock_region_tree():
            parent_id = ids[node["parent"]] if node["parent"] else None
            region = make_region(name=node["name"], parent_id=parent_id)
            ids[node["name"]] = region.id

    Shape: ``Europe -> [Germany -> [Bavaria], France]``.
    """
    return [
        {"name": "Europe", "parent": None},
        {"name": "Germany", "parent": "Europe"},
        {"name": "Bavaria", "parent": "Germany"},
        {"name": "France", "parent": "Europe"},
    ]
