"""Unit tests for ``get_all_descendant_regions`` using a faked session.

The function walks a region tree with repeated
``select(Region).filter_by(parent_id=...)`` queries.  Instead of a database we
monkeypatch the module-level ``db`` with a fake session whose ``execute`` reads
the bound ``parent_id`` out of the compiled statement and returns fake region
rows (``SimpleNamespace(id=...)``).  No real DB, session or network is used.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy import select

from app.controllers import region_controller
from app.controllers.region_controller import get_all_descendant_regions
from app.models.region import Region

pytestmark = pytest.mark.unit


def _extract_parent_id(params):
    """Return the ``parent_id`` bind value from ``statement.compile().params``.

    SQLAlchemy may name the bind parameter ``parent_id`` or ``parent_id_1``
    depending on how many binds are present, so match on the prefix.
    """
    for key, value in params.items():
        if key == "parent_id" or key.startswith("parent_id"):
            return value
    raise AssertionError(f"no parent_id bind parameter in {params!r}")


def _make_session(children_by_parent):
    """Build a fake ``db.session`` backed by ``{parent_id: [child_ids]}``."""

    def _execute(statement, *args, **kwargs):
        parent_id = _extract_parent_id(statement.compile().params)
        children = children_by_parent.get(parent_id, [])
        result = MagicMock()
        result.scalars.return_value.all.return_value = [
            SimpleNamespace(id=child_id) for child_id in children
        ]
        return result

    session = MagicMock()
    session.execute.side_effect = _execute
    return session


@pytest.fixture()
def fake_session(monkeypatch):
    """Patch ``region_controller.db`` and yield a configured fake session."""

    def _install(children_by_parent):
        session = _make_session(children_by_parent)
        monkeypatch.setattr(region_controller, "db", SimpleNamespace(session=session))
        return session

    return _install


def test_filter_by_produces_parent_id_bind_param():
    """The extraction strategy matches the real compiled query."""
    params = select(Region).filter_by(parent_id=42).compile().params
    assert _extract_parent_id(params) == 42


def test_leaf_region_returns_only_itself(fake_session):
    fake_session({5: []})

    assert get_all_descendant_regions(5) == [5]


def test_multi_level_tree_returns_all_descendants_including_self(fake_session):
    fake_session(
        {
            1: [2, 3],
            2: [4],
            4: [7],
            3: [5],
            5: [6],
        }
    )

    result = get_all_descendant_regions(1)

    assert set(result) == {1, 2, 3, 4, 5, 6, 7}
    assert len(result) == 7


def test_diamond_graph_returns_each_id_exactly_once(fake_session):
    """A shared child reached via two parents is collected once, no loop."""
    fake_session(
        {
            1: [2, 3],
            2: [4],
            3: [4],
            4: [],
        }
    )

    result = get_all_descendant_regions(1)

    assert set(result) == {1, 2, 3, 4}
    assert len(result) == 4


def test_unknown_region_returns_only_itself(fake_session):
    fake_session({})

    assert get_all_descendant_regions(99) == [99]


def test_returns_a_list_instance(fake_session):
    fake_session({1: [2]})

    result = get_all_descendant_regions(1)

    assert isinstance(result, list)


def test_only_children_of_requested_subtree_are_returned(fake_session):
    """A sibling branch (parent_id 3) is not reached from region 1."""
    fake_session(
        {
            1: [2],
            2: [],
            3: [4],
            4: [],
        }
    )

    result = get_all_descendant_regions(1)

    assert set(result) == {1, 2}
