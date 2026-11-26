"""Conexiunea la PostgreSQL si migrarile (Alembic)."""
import os

import psycopg
from alembic import command
from alembic.config import Config

URL = os.environ.get("DATABASE_URL", "postgresql://masuratori:masuratori@localhost:5432/masuratori")
_AICI = os.path.dirname(os.path.abspath(__file__))


def conecteaza():
    """Conexiune noua; folosita cu `with`, face commit la iesire (rollback la eroare)."""
    return psycopg.connect(URL)


def migreaza():
    """Aduce schema bazei la ultima migrare (echivalent cu `alembic upgrade head`)."""
    try:
        psycopg.connect(URL, connect_timeout=3).close()
    except psycopg.OperationalError as e:
        raise SystemExit(f"Nu ma pot conecta la PostgreSQL ({e}).\n"
                         "Porneste Docker Desktop si ruleaza `docker compose up -d`.")
    cfg = Config(os.path.join(_AICI, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(_AICI, "migrari"))
    command.upgrade(cfg, "head")
