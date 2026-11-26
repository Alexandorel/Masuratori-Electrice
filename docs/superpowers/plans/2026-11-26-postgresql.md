# Stocare in PostgreSQL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utilizatorii, sesiunile si masuratorile trec din SQLite/CSV in PostgreSQL (Docker), cu schema creata prin migrari Alembic; `/api/curent` si `/api/istoric` cer token.

**Architecture:** `db.py` tine URL-ul, conexiunea psycopg si rularea migrarilor. `auth.py` si `server.py` scriu SQL de mana prin `db.conecteaza()`. Alembic se foloseste doar pentru migrari si ruleaza automat la pornirea serverului, a demo-ului si a testelor.

**Tech Stack:** Python 3.12, FastAPI, psycopg 3 (`psycopg[binary]`), Alembic, PostgreSQL 17 in Docker, React (doar 2 fisiere atinse).

**Spec:** `docs/superpowers/specs/2026-11-26-postgresql-design.md`

## Global Constraints

- Branch: `postgresql` (pornit din `origin/login-register`). Commit-urile nu au linii `Co-Authored-By`.
- Forma cererilor si raspunsurilor `/api/auth/*` si `/api/istoric` nu se schimba. `timp` iese ca text `YYYY-MM-DDTHH:MM:SS`.
- `DATABASE_URL` implicit: `postgresql://masuratori:masuratori@localhost:5432/masuratori`. Testele folosesc `.../masuratori_test`, iar demo-ul `.../masuratori_demo`. Nu scriu niciodata in `masuratori`.
- Testele raman un script simplu: `python test_server.py` (proiectul nu foloseste pytest). Cer Docker Desktop pornit si `docker compose up -d`.
- Comentariile si mesajele de eroare sunt in romana, fara diacritice, ca in codul existent.
- Frontend: se modifica doar `frontend/src/api.js` si `frontend/src/App.jsx`, strict ce scrie in Task 4.

## Review Focus

1. PostgreSQL nu e pornit cand rulezi `python server.py`: serverul trebuie sa se opreasca cu un mesaj clar („Nu ma pot conecta la PostgreSQL ... ruleaza `docker compose up -d`”), nu cu un traceback. Testul e in Task 1.
2. PostgreSQL cade cat timp merge serverul: bucla de citire nu are voie sa moara; scrie eroarea si reincearca la urmatoarea citire. Testul e in Task 3.
3. Token lipsa, gresit sau deja delogat pe `/api/curent` si `/api/istoric`: raspuns 401, nu date. Testul e in Task 3.
4. `de_la`/`pana_la` invalide (`abc`) pe `/api/istoric`: raspuns 422, nu 500. Testul e in Task 3.
5. Utilizator inregistrat cu spatii („ ana ”) se poate loga ca „ana”, iar acelasi nume de doua ori da 409. Testul e in Task 2.

---

### Task 1: PostgreSQL in Docker + migrari

**Files:**
- Create: `docker-compose.yml`, `docker/init.sql`, `db.py`, `alembic.ini`, `migrari/env.py`, `migrari/script.py.mako`, `migrari/versions/0001_initial.py`
- Modify: `requirements.txt`, `.gitignore` (nou daca lipseste)
- Test: `test_server.py`

**Interfaces:**
- Produces:
  - `db.URL: str`: citit din `DATABASE_URL`; testele il suprascriu inainte de orice apel.
  - `db.conecteaza() -> psycopg.Connection`: conexiune noua la `db.URL`, folosita cu `with`, care face commit la iesire.
  - `db.migreaza() -> None`: `alembic upgrade head` pe `db.URL`. Daca PostgreSQL nu raspunde, ridica `SystemExit` cu mesajul din Review Focus 1.
  - Tabele: `utilizatori(id serial PK, username text unique not null, parola_hash text not null, salt text not null)`, `sesiuni(token text PK, username text not null, creat_la timestamp not null)`, `masuratori(id bigserial PK, timp timestamp not null, valori jsonb not null)` + index `ix_masuratori_timp`.

- [ ] **Step 1: Docker.** `docker-compose.yml`: serviciul `db` cu `postgres:17`, `POSTGRES_USER/PASSWORD/DB=masuratori`, port `5432:5432`, volum `pgdata`, iar `./docker/init.sql` montat in `/docker-entrypoint-initdb.d/`. `init.sql` contine `CREATE DATABASE masuratori_test; CREATE DATABASE masuratori_demo;`. Ruleaza `docker compose up -d`, apoi `docker compose exec db psql -U masuratori -l`. Rezultatul asteptat: apar cele 3 baze.
- [ ] **Step 2: Scrie testul care pica.** Rescrie `test_server.py` ca script cu functii apelate din `if __name__ == "__main__"`, in ordinea in care apar in plan. In capul fisierului: `db.URL = "postgresql://masuratori:masuratori@localhost:5432/masuratori_test"`.

```python
def test_migrari():
    db.migreaza()
    with db.conecteaza() as con:
        tabele = {r[0] for r in con.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")}
    assert {"utilizatori", "sesiuni", "masuratori", "alembic_version"} <= tabele
    db.migreaza()  # a doua oara nu face nimic si nu pica

def test_fara_postgres():
    url, db.URL = db.URL, "postgresql://x:x@localhost:1/x"
    try:
        db.migreaza(); assert False
    except SystemExit as e:
        assert "docker compose up -d" in str(e)
    finally:
        db.URL = url
```

- [ ] **Step 3:** Ruleaza `python test_server.py`. Rezultatul asteptat: `ModuleNotFoundError: db`.
- [ ] **Step 4: Implementeaza.** `requirements.txt` primeste `psycopg[binary]` si `alembic`. `db.py` contine ce scrie la Interfaces. `migreaza()` construieste `alembic.config.Config("alembic.ini")` cu cai absolute fata de `db.py` si apeleaza `command.upgrade(cfg, "head")`; inainte verifica `psycopg.connect(URL, connect_timeout=3)` si transforma `psycopg.OperationalError` in `SystemExit`. `migrari/env.py` ia URL-ul din `db.URL`, inlocuieste `postgresql://` cu `postgresql+psycopg://` si ruleaza doar online. `0001_initial.py` creeaza tabelele de mai sus cu `op.create_table` si le sterge in `downgrade`. `.gitignore`: `__pycache__/`.
- [ ] **Step 5:** Ruleaza `pip install -r requirements.txt` si apoi `python test_server.py`. Rezultatul asteptat: cele doua teste trec. (Testele vechi din fisier pot pica pana la Task 3, asa ca in Task 1 ruleaza doar aceste doua functii.)
- [ ] **Step 6: Commit** `postgresql in docker + migrari alembic`.

### Task 2: auth.py pe PostgreSQL

**Files:**
- Modify: `auth.py`
- Test: `test_server.py`

**Interfaces:**
- Consumes: `db.conecteaza()`, tabelele `utilizatori` si `sesiuni`.
- Produces: `auth.utilizator_curent(authorization: str | None = Header(default=None)) -> str`, care intoarce username-ul sau ridica `HTTPException(401)`. Se foloseste in `/api/auth/me` si in Task 3 prin `Depends`.

- [ ] **Step 1: Scrie testul care pica.** Foloseste un `TestClient(server.app)` comun si incepe cu `TRUNCATE utilizatori, sesiuni, masuratori`.

```python
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
```

- [ ] **Step 2:** Ruleaza testul. Rezultatul asteptat: pica, pentru ca `auth.py` inca scrie in `utilizatori.db` si duplicatul nu da 409 pe PostgreSQL.
- [ ] **Step 3: Implementeaza.** In `auth.py`: `sqlite3` se inlocuieste cu `db.conecteaza()`, `?` cu `%s`, `sqlite3.IntegrityError` cu `psycopg.errors.UniqueViolation`; `row_factory` devine `psycopg.rows.dict_row` pe cursor. Se sterg `DB_PATH`, `get_db`, `init_db` si apelul `init_db()`. Verificarea din `me` se muta in `utilizator_curent`, iar `me` devine `def me(username: str = Depends(utilizator_curent)) -> {"username": username}`. Hash-ul, salt-ul, token-ul si mesajele raman exact ca acum.
- [ ] **Step 4:** Ruleaza testul. Rezultatul asteptat: trece.
- [ ] **Step 5: Commit** `auth pe postgresql`.

### Task 3: masuratori in PostgreSQL + endpoint-uri protejate

**Files:**
- Modify: `server.py`
- Test: `test_server.py`

**Interfaces:**
- Consumes: `db.conecteaza()`, `db.migreaza()`, `auth.utilizator_curent`.
- Produces: aceleasi endpoint-uri. `curent()` si `istoric(de_la: datetime | None, pana_la: datetime | None, limita: int = 1000)` primesc `_: str = Depends(utilizator_curent)`. `bucla_citire(client, unit, interval)` are aceeasi semnatura.

- [ ] **Step 1: Scrie testele care pica.** Pastreaza ce verifica testul vechi (registre false, `Stop` pe `time.sleep`), adaptat la token:

```python
def test_masuratori(c, h):  # h = header cu token valid, din login
    assert c.get("/api/curent").status_code == 401
    assert c.get("/api/curent", headers={"Authorization": "Bearer gresit"}).status_code == 401
    assert c.get("/api/istoric", headers=h).json() == []
    # ruleaza bucla o data (ca in testul vechi)
    cur = c.get("/api/curent", headers=h).json()
    ist = c.get("/api/istoric", params={"de_la": "2000-01-01"}, headers=h).json()
    assert len(ist) == 1 and ist[0]["timp"] == cur["timp"] and len(ist[0]["timp"]) == 19
    assert ist[0]["valori"].keys() == cur["valori"].keys()
    assert c.get("/api/istoric", params={"de_la": "2999-01-01"}, headers=h).json() == []
    assert c.get("/api/istoric", params={"de_la": "abc"}, headers=h).status_code == 422
    # limita = ultimele N, in ordine cronologica
    # insereaza 2001-01-01 si 2002-01-01, iar cu pana_la=2003-01-01, limita=2 asteapta exact acele doua, in ordine

def test_bucla_supravietuieste_bazei_cazute():
    # db.conecteaza pica la prima chemare (OperationalError), merge la a doua;
    # bucla ruleaza 2 iteratii -> in masuratori exista 1 rand, iar bucla n-a ridicat exceptia
```

- [ ] **Step 2:** Ruleaza. Rezultatul asteptat: pica, pentru ca `/api/curent` raspunde fara token si istoricul vine din CSV.
- [ ] **Step 3: Implementeaza** in `server.py`:
  - `bucla_citire` salveaza fiecare citire cu `INSERT INTO masuratori (timp, valori) VALUES (%s, %s)` si `psycopg.types.json.Jsonb(valori)`. Conexiunea se deschide la nevoie. La `psycopg.Error` scrie `Eroare baza de date: ...`, inchide conexiunea, o pune `None` si continua. `ultima` se actualizeaza oricum.
  - `/api/istoric` foloseste `WHERE (%s::timestamp IS NULL OR timp >= %s) AND (... pana_la)`, apoi `ORDER BY timp DESC LIMIT %s`. Randurile se intorc in ordine inversa, cu `timp.isoformat(timespec="seconds")`.
  - Se scot `csv`, `os`, `CSV_PATH`, `numar`, `fmt` si `--csv`. `main()` apeleaza `db.migreaza()` inainte sa deschida portul serial.
- [ ] **Step 4:** Ruleaza `python test_server.py`. Rezultatul asteptat: toate testele trec si se afiseaza `OK ...`.
- [ ] **Step 5: Commit** `masuratori in postgresql, endpoint-uri cu token`.

### Task 4: demo, frontend, README

**Files:**
- Modify: `server_demo.py`, `frontend/src/api.js`, `frontend/src/App.jsx`, `README.md`

**Interfaces:**
- Consumes: `db.URL`, `db.migreaza()`; endpoint-urile protejate din Task 3.

- [ ] **Step 1: `server_demo.py`.** In loc de CSV-ul temporar, seteaza `db.URL` pe `masuratori_demo` (doar daca `DATABASE_URL` nu e setata) si apeleaza `db.migreaza()`. Docstring-ul se actualizeaza.
- [ ] **Step 2: `api.js`.** `cere()` trimite `Authorization: Bearer <token>` cand exista token in `localStorage`, ca `cereAuth()`.
- [ ] **Step 3: `App.jsx`.** Efectele pentru `curent` si `istoric` incep cu `if (!utilizator) return` si au `utilizator` in dependinte. Efectul pentru `obiecte` ramane neschimbat (endpoint public).
- [ ] **Step 4: README.** Sectiune noua inainte de „Rulare”: porneste Docker Desktop, apoi `docker compose up -d`; migrarile ruleaza singure (sau manual cu `alembic upgrade head`); pentru alta baza seteaza `DATABASE_URL`; parola din `docker-compose.yml` e doar pentru dezvoltare. Demo-ul scrie in `masuratori_demo`. In tabelul de endpoint-uri: `/api/curent` si `/api/istoric` cer `Authorization: Bearer <token>`, plus randurile `/api/auth/*`.
- [ ] **Step 5: Verificare manuala.** Ruleaza `python server_demo.py` si `cd frontend && npm run dev`. Apoi creezi cont, te loghezi, vezi dashboard-ul cu valori si grafic fara refresh, iar dupa deconectare revii la login. Separat, `curl localhost:8000/api/curent` da 401.
- [ ] **Step 6: Commit** `demo, frontend si README pentru postgresql`.
