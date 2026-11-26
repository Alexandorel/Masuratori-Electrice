"""tabelele initiale: utilizatori, sesiuni, masuratori

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "utilizatori",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.Text, nullable=False, unique=True),
        sa.Column("parola_hash", sa.Text, nullable=False),
        sa.Column("salt", sa.Text, nullable=False),
    )
    op.create_table(
        "sesiuni",
        sa.Column("token", sa.Text, primary_key=True),
        sa.Column("username", sa.Text, nullable=False),
        sa.Column("creat_la", sa.DateTime, nullable=False),
    )
    op.create_table(
        "masuratori",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("timp", sa.DateTime, nullable=False),
        sa.Column("valori", JSONB, nullable=False),
    )
    op.create_index("ix_masuratori_timp", "masuratori", ["timp"])


def downgrade():
    op.drop_table("masuratori")
    op.drop_table("sesiuni")
    op.drop_table("utilizatori")
