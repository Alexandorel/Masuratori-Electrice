"""Rulare: docker compose up -d, apoi python test_server.py
(fara hardware: Modbus e inlocuit cu registre false; scrie doar in baza masuratori_test)"""
import struct

import psycopg

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


def goleste():
    with db.conecteaza() as con:
        con.execute("TRUNCATE utilizatori, sesiuni, masuratori")


def test_auth(c):
    assert c.post("/api/auth/register", json={"username": " ana ", "parola": "secret1"}).status_code == 201
    assert c.post("/api/auth/register", json={"username": "ana", "parola": "secret1"}).status_code == 409
    assert c.post("/api/auth/register", json={"username": "ab", "parola": "secret1"}).status_code == 400
    assert c.post("/api/auth/login", json={"username": "ana", "parola": "gresit"}).status_code == 401
    r = c.post("/api/auth/login", json={"username": "ana", "parola": "secret1"}).json()
    h = {"Authorization": f"Bearer {r['token']}"}
    assert r["username"] == "ana" and c.get("/api/auth/me", headers=h).json() == {"username": "ana"}
    c.post("/api/auth/logout", headers=h)
    assert c.get("/api/auth/me", headers=h).status_code == 401
    with db.conecteaza() as con:
        assert con.execute("SELECT count(*) FROM utilizatori").fetchone()[0] == 1


def ruleaza_bucla(iteratii):
    """Ruleaza bucla de citire de `iteratii` ori (time.sleep opreste bucla dupa ultima)."""
    pasi = iter(range(iteratii - 1))
    server.time.sleep = lambda s: next(pasi, None) is None and (_ for _ in ()).throw(Stop())
    try:
        server.bucla_citire(None, 2, 0)
    except Stop:
        pass


def autentificare(c):
    c.post("/api/auth/register", json={"username": "ion", "parola": "secret1"})
    token = c.post("/api/auth/login", json={"username": "ion", "parola": "secret1"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_masuratori(c):
    citire_contor.citeste = registre_false
    h = autentificare(c)
    assert c.get("/api/curent").status_code == 401
    assert c.get("/api/istoric").status_code == 401
    assert c.get("/api/curent", headers={"Authorization": "Bearer gresit"}).status_code == 401
    assert c.get("/api/curent", headers=h).status_code == 503
    assert c.get("/api/istoric", headers=h).json() == []

    ruleaza_bucla(1)

    cur = c.get("/api/curent", headers=h).json()
    assert cur["timp"] and len(cur["valori"]) == len(server.COLOANE)
    ist = c.get("/api/istoric", params={"de_la": "2000-01-01"}, headers=h).json()
    assert len(ist) == 1 and ist[0]["timp"] == cur["timp"] and len(ist[0]["timp"]) == 19
    assert ist[0]["valori"].keys() == cur["valori"].keys()
    assert c.get("/api/istoric", params={"de_la": "2999-01-01"}, headers=h).json() == []
    assert c.get("/api/istoric", params={"de_la": "abc"}, headers=h).status_code == 422
    assert len(c.get("/api/obiecte").json()) == len(server.COLOANE)
    assert server.curata(float("nan")) is None

    # limita = ultimele N randuri din interval, in ordine cronologica
    with db.conecteaza() as con:
        for t in ["2001-01-01", "2002-01-01", "2000-06-01"]:
            con.execute("INSERT INTO masuratori (timp, valori) VALUES (%s, '{}')", (t,))
    ist = c.get("/api/istoric", params={"pana_la": "2003-01-01", "limita": 2}, headers=h).json()
    assert [r["timp"] for r in ist] == ["2001-01-01T00:00:00", "2002-01-01T00:00:00"], ist

    c.post("/api/auth/logout", headers=h)
    assert c.get("/api/curent", headers=h).status_code == 401
    return cur


def test_bucla_supravietuieste_bazei_cazute():
    """Daca PostgreSQL cade, bucla scrie eroarea si continua la citirea urmatoare."""
    goleste()
    original, apeluri = db.conecteaza, []

    def conecteaza_care_pica_o_data():
        apeluri.append(1)
        if len(apeluri) == 1:
            raise psycopg.OperationalError("baza cazuta (test)")
        return original()

    db.conecteaza = conecteaza_care_pica_o_data
    try:
        ruleaza_bucla(2)
    finally:
        db.conecteaza = original
    with db.conecteaza() as con:
        assert con.execute("SELECT count(*) FROM masuratori").fetchone()[0] == 1


def test_demo_nu_scrie_in_baza_reala():
    import server_demo
    url, db.URL = db.URL, "postgresql://u:p@gazda:5432/masuratori"  # ca si cum DATABASE_URL arata spre baza reala
    try:
        server_demo.alege_baza_demo()
        assert db.URL == "postgresql://u:p@gazda:5432/masuratori_demo", db.URL
    finally:
        db.URL = url


if __name__ == "__main__":
    test_migrari()
    test_fara_postgres()
    test_demo_nu_scrie_in_baza_reala()
    goleste()
    c = TestClient(server.app)
    test_auth(c)
    cur = test_masuratori(c)
    test_bucla_supravietuieste_bazei_cazute()
    print("OK", cur["valori"]["IL1"])
