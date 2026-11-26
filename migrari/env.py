import os
import sys

from alembic import context
from sqlalchemy import create_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402

motor = create_engine(db.URL.replace("postgresql://", "postgresql+psycopg://", 1))
with motor.connect() as conexiune:
    context.configure(connection=conexiune)
    with context.begin_transaction():
        context.run_migrations()
