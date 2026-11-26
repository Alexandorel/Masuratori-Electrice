# Masuratori-Electrice

Backend FastAPI (doar citire) peste `citire_contor.py`.

**Instalare:**
```
pip install -r requirements.txt
```

**Baza de date (PostgreSQL in Docker):** porneste Docker Desktop, apoi:
```
docker compose up -d
```
Tabelele se creeaza/actualizeaza singure la pornirea serverului (migrari Alembic in `migrari/`). Manual: `alembic upgrade head`.
Alta baza: seteaza `DATABASE_URL=postgresql://user:parola@host:port/baza`. Parola din `docker-compose.yml` e doar pentru dezvoltare.

**Rulare** (aceleasi optiuni seriale ca `citire_contor.py`, plus `--http-port 8000`):
```
python server.py --port /dev/ttyUSB0
```
Fara `--port`, portul se alege automat daca e conectat un singur adaptor USB-serial (valabil si pentru `citire_contor.py`).

Documentatie API interactiva: http://localhost:8000/docs

**Fara aparat (demo):** acelasi server, dar cu valori false care se schimba in timp. Istoricul se scrie in baza `masuratori_demo`, nu in baza reala.
```
python server_demo.py
```

## Frontend (React)

```
cd frontend
npm install
npm run dev
```

Daca serverul nu e pe `http://localhost:8000`, creeaza `frontend/.env` cu `VITE_API_URL=http://adresa:port`.

## Endpoint-uri

| Endpoint | Descriere |
|---|---|
| `GET /api/obiecte` | nume, unitate, descriere pentru fiecare marime |
| `GET /api/curent` | ultima citire (cere token) |
| `GET /api/istoric?de_la=...&pana_la=...` | randuri din PostgreSQL (cere token; timp ISO, ex. `2026-10-23T10:06`) |
| `POST /api/auth/register` | `{username, parola}` -> cont nou |
| `POST /api/auth/login` | `{username, parola}` -> `{token, username}` |
| `GET /api/auth/me` | utilizatorul token-ului |
| `POST /api/auth/logout` | invalideaza token-ul |

Endpoint-urile care cer token primesc header-ul `Authorization: Bearer <token>`.

**Teste:** `docker compose up -d`, apoi `python test_server.py` (scrie doar in baza `masuratori_test`).