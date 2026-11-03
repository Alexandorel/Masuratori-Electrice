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

Documentatie API interactiva: http://localhost:8000/docs

## Endpoint-uri

| Endpoint | Descriere |
|---|---|
| `GET /api/obiecte` | nume, unitate, descriere pentru fiecare marime |
| `GET /api/curent` | ultima citire |
| `GET /api/istoric?de_la=...&pana_la=...` | randuri din CSV (timp ISO, ex. `2026-10-23T10:06`) |