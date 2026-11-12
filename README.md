# Masuratori-Electrice

Backend FastAPI (doar citire) peste `citire_contor.py`.

**Instalare:**
```
pip install -r requirements.txt
```

**Rulare** (aceleasi optiuni seriale ca `citire_contor.py`, plus `--http-port 8000`):
```
python server.py --port /dev/ttyUSB0
```
Fara `--port`, portul se alege automat daca e conectat un singur adaptor USB-serial (valabil si pentru `citire_contor.py`).

Documentatie API interactiva: http://localhost:8000/docs

**Fara aparat (demo):** acelasi server, dar cu valori false care se schimba in timp. Istoricul se scrie intr-un CSV temporar, nu in `masuratori.csv`.
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
| `GET /api/curent` | ultima citire |
| `GET /api/istoric?de_la=...&pana_la=...` | randuri din CSV (timp ISO, ex. `2026-10-23T10:06`) |