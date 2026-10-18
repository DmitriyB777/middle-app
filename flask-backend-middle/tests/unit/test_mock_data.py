"""Unit tests for the pure mock-data helpers in ``tests.fixtures.data``.

These helpers are shared by the other layers, so a quick sanity check keeps
their contract (fresh objects, stable keys, a well-ordered region tree) from
silently drifting.
"""

from __future__ import annotations

import pytest

from tests.fixtures.data import (
    mock_city_payload,
    mock_region_payload,
    mock_region_tree,
    mock_user_payload,
)

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    ("factory", "expected_keys"),
    [
        (mock_user_payload, {"username", "password"}),
        (mock_region_payload, {"name", "parent_id"}),
        (mock_city_payload, {"name", "region_id"}),
    ],
)
def test_payload_factories_return_expected_keys(factory, expected_keys):
    assert set(factory()) == expected_keys


@pytest.mark.parametrize(
    "factory",
    [mock_user_payload, mock_region_payload, mock_city_payload, mock_region_tree],
)
def test_factories_return_fresh_objects_each_call(factory):
    first = factory()
    second = factory()

    assert first is not second
    assert first == second


def test_mutating_one_payload_does_not_leak_into_the_next():
    first = mock_user_payload()
    second = mock_user_payload()

    first["username"] = "changed"

    assert second["username"] == "testuser"


def test_region_tree_nodes_have_name_and_parent_keys():
    for node in mock_region_tree():
        assert set(node) == {"name", "parent"}


def test_region_tree_parents_reference_earlier_names_or_none():
    seen = set()
    for node in mock_region_tree():
        parent = node["parent"]
        assert parent is None or parent in seen, (
            f"node {node!r} references parent {parent!r} before it appears"
        )
        seen.add(node["name"])


def test_region_tree_has_a_single_root():
    roots = [node for node in mock_region_tree() if node["parent"] is None]

    assert roots == [{"name": "Europe", "parent": None}]


def test_region_tree_is_fresh_per_call():
    first = mock_region_tree()
    second = mock_region_tree()

    first[0]["name"] = "changed"

    assert second[0]["name"] == "Europe"
