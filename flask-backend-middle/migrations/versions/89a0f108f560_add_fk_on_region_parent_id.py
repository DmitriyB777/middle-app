"""add fk on region.parent_id

Revision ID: 89a0f108f560
Revises: e2f0d187ea67
Create Date: 2026-10-11 22:47:21.129528

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "89a0f108f560"
down_revision = "e2f0d187ea67"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("region", schema=None) as batch_op:
        batch_op.create_index("ix_region_parent_id", ["parent_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_region_parent_id_region", "region", ["parent_id"], ["id"]
        )


def downgrade():
    with op.batch_alter_table("region", schema=None) as batch_op:
        batch_op.drop_constraint("fk_region_parent_id_region", type_="foreignkey")
        batch_op.drop_index("ix_region_parent_id")
