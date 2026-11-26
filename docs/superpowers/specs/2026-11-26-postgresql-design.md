# Stocare in PostgreSQL cu migrari

## De ce

Profesorul a cerut conturi de utilizator cu login. Colegul de la login (PR #4, `auth.py`) a folosit SQLite, iar echipa a hotarat sa nu se foloseasca SQLite. Datele trec in PostgreSQL, cu migrari, ca orice coleg sa-si aduca baza la zi fara pasi manuali.

## Obiective

- Utilizatorii si sesiunile din `auth.py` se muta din `utilizatori.db` (SQLite) in PostgreSQL.
- Masuratorile se muta din `masuratori.csv` in PostgreSQL.
- Schema bazei se defineste prin migrari Alembic, nu prin `CREATE TABLE` in cod.
- Un coleg porneste proiectul cu `docker compose up -d` si apoi `python server.py`. Nu are de facut alti pasi.

## Ce nu intra

- Roluri si pagina de admin (nu sunt cerute).
- Export.
- Mutarea randurilor vechi din `masuratori.csv`: sunt 97 de randuri, toate cu zero. Fisierul ramane in repo, dar nu se mai scrie in el.
- Expirarea sesiunilor: ramane ca in PR #4, adica token-ul e valid pana la logout.
- Alte modificari in frontend, in afara celor doua de la „Protectia datelor”.

## Ce nu are voie sa se intample

- Adresele `/api/auth/*` si `/api/istoric` nu isi schimba forma cererilor sau a raspunsurilor. Pagina de login si graficele trebuie sa mearga neatinse.
- Testele si demo-ul nu scriu niciodata in baza reala.
- Daca PostgreSQL cade un timp, serverul nu se opreste din citit. Bucla de citire se reconecteaza.

## Variante de constructie

| Varianta | Pe scurt | De ce da / nu |
|---|---|---|
| **A. psycopg + Alembic** (aleasa) | SQL scris de mana, ca in `auth.py`; Alembic doar pentru migrari | Cea mai mica schimbare in codul colegului; Alembic e standard |
| B. SQLAlchemy ORM + Alembic | tabele ca si clase Python, migrari generate | Rescrie tot `auth.py`, colegii trebuie sa invete ORM-ul; prea mult pentru 3 tabele |
| C. fisiere `.sql` + script propriu | fara dependinta noua | Am reinventa Alembic |

PostgreSQL ruleaza in Docker, din `docker-compose.yml` (ales de user). Alternativa era instalarea clasica pe fiecare calculator.

## Cum arata

**Docker** (`docker-compose.yml`): imaginea `postgres:17`, cu port 5432, utilizator, parola si baza `masuratori`, plus un volum ca datele sa ramana dupa restart. Un script `docker/init.sql` creeaza si bazele `masuratori_test` si `masuratori_demo`.

**Conexiune:** variabila de mediu `DATABASE_URL`. Implicit e `postgresql://masuratori:masuratori@localhost:5432/masuratori`, exact ce porneste docker-compose, deci colegii nu configureaza nimic.

**Migrari:** `alembic.ini` + `migrari/`. Prima migrare creeaza:
- `utilizatori(id serial PK, username text unique not null, parola_hash text not null, salt text not null)`, la fel ca in PR #4;
- `sesiuni(token text PK, username text not null, creat_la timestamp not null)`;
- `masuratori(id bigserial PK, timp timestamp not null, valori jsonb not null)`, cu index pe `timp`.

Serverul, demo-ul si testele ruleaza `alembic upgrade head` automat la pornire, prin API-ul Python al Alembic. Comanda `alembic upgrade head` ramane disponibila si manual.

**Cod:**
- `db.py` (nou): `URL`, `conecteaza()` (pentru psycopg) si `migreaza()`.
- `auth.py`: `sqlite3` se inlocuieste cu `db.conecteaza()`, `?` cu `%s`, `IntegrityError` cu `psycopg.errors.UniqueViolation`, iar `init_db()` se sterge. Logica ramane neschimbata (hash, salt, token).
- `server.py`: bucla de citire face `INSERT` in `masuratori` in loc de CSV; la o eroare a bazei scrie in consola, se reconecteaza si continua. `/api/istoric` face `SELECT ... WHERE timp BETWEEN ... ORDER BY timp DESC LIMIT` si intoarce `timp` ca text ISO pe secunde, ca pana acum. `--csv` se scoate.
- `server_demo.py`: foloseste `masuratori_demo` in loc de CSV-ul temporar.
- `test_server.py`: foloseste `masuratori_test`, goleste tabelele la inceput, testeaza ce testa si pana acum plus register, login, `me` si logout pe PostgreSQL.
- `requirements.txt`: `psycopg[binary]` si `alembic`.
- `README.md`: pasul cu Docker, `DATABASE_URL` si `alembic upgrade head`.
- `.gitignore`: `__pycache__/`.

**Git:** branch-ul `postgresql` porneste din `login-register` (PR #4). PR-ul se deschide spre `main` dupa ce #4 intra in `main`, sau spre `login-register` daca #4 inca asteapta.

## Lasat la alegerea celui care construieste

- Numele exacte ale functiilor si ale migrarii.
- Cum se goleste baza de test (`TRUNCATE`).

## Protectia datelor (hotarat de user)

`/api/curent` si `/api/istoric` cer `Authorization: Bearer <token>` valid, altfel raspund cu 401. `/api/obiecte` ramane public, pentru ca are doar nume si unitati, nu masuratori. Verificarea foloseste aceeasi logica ca `/api/auth/me` (o dependinta FastAPI comuna in `auth.py`).

Asta cere doua mici modificari in frontend-ul colegului (exceptie de la „fara frontend”):
- `api.js`: `cere()` trimite token-ul din `localStorage`, la fel ca `cereAuth()`.
- `App.jsx`: efectele pentru `curent` si `istoric` ruleaza acum inainte de login. Ele trebuie sa astepte `utilizator` (sa iasa daca e `null` si sa-l aiba in dependinte), altfel dupa login dashboard-ul ramane gol pana la reincarcarea paginii.
