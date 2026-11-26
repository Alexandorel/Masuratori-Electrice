"""Rulare: docker compose up -d, apoi python test_server.py
(fara hardware: Modbus e inlocuit cu registre false; scrie doar in baza masuratori_test)"""
import os
import struct
import tempfile

import db

db.URL = "postgresql://masuratori:masuratori@localhost:5432/masuratori_test"

from fastapi.testclient import TestClient  # noqa: E402

import citire_contor  # noqa: E402
import server  # noqa: E402


class Stop(Exception):
    pass


def registre_false(client, adresa, count, unit):
    if adresa == 0x07D1:
        return [1, 1]
    hi, lo = struct.unpack(">HH", struct.pack(">f", 230.5))
    return [lo, hi] * (count // 2) + [0] * (count % 2)


def test_migrari():
    db.migreaza()
    with db.conecteaza() as con:
        tabele = {r[0] for r in con.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")}
    assert {"utilizatori", "sesiuni", "masuratori", "alembic_version"} <= tabele, tabele
    db.migreaza()  # a doua oara nu face nimic si nu pica


def test_fara_postgres():
    url, db.URL = db.URL, "postgresql://x:x@localhost:1/x"
    try:
        db.migreaza()
        assert False, "trebuia SystemExit"
    except SystemExit as e:
        assert "docker compose up -d" in str(e)
    finally:
        db.URL = url


def test():
    citire_contor.citeste = registre_false
    server.CSV_PATH = os.path.join(tempfile.mkdtemp(), "m.csv")
    c = TestClient(server.app)
    assert c.get("/api/curent").status_code == 503
    assert c.get("/api/istoric").json() == []

    server.time.sleep = lambda s: (_ for _ in ()).throw(Stop())
    try:
        server.bucla_citire(None, 2, 0)
    except Stop:
        pass

    cur = c.get("/api/curent").json()
    assert cur["timp"] and len(cur["valori"]) == len(server.COLOANE)
    ist = c.get("/api/istoric", params={"de_la": "2000-01-01"}).json()
    assert len(ist) == 1 and ist[0]["valori"].keys() == cur["valori"].keys()
    assert c.get("/api/istoric", params={"de_la": "2999-01-01"}).json() == []
    assert len(c.get("/api/obiecte").json()) == len(server.COLOANE)
    assert server.curata(float("nan")) is None and server.numar("nan") is None
    print("OK", cur["valori"]["IL1"], ist[0]["valori"]["IL1"])


if __name__ == "__main__":
    test_migrari()
    test_fara_postgres()
    print("OK")
