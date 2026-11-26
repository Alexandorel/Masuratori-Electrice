import argparse
import math
import threading
import time
from datetime import datetime

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg.types.json import Jsonb
from pymodbus.client import ModbusSerialClient

import db
from auth import router as auth_router, utilizator_curent
from citire_contor import (OBIECTE, citeste_tot, construieste_blocuri, gaseste_port,
                           ordine_cuvinte)

COLOANE = [o[0] for o in OBIECTE] + ["Durata_viata_%"]

app = FastAPI(title="Contor Eaton PXR")
# Permitem toate metodele (inclusiv POST pentru auth) si header-ul Authorization.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# Atasam rutele de autentificare (/api/auth/register, /login, /me, /logout).
app.include_router(auth_router)

ultima = {"timp": None, "valori": None}
lacat = threading.Lock()


def curata(v):
    """NaN/inf nu sunt JSON valid -> None."""
    return None if isinstance(v, float) and not math.isfinite(v) else v


def bucla_citire(client, unit, interval):
    float_low, fixed_low = ordine_cuvinte(client, unit)
    blocuri = construieste_blocuri()
    con = None
    while True:
        try:
            rez = citeste_tot(client, unit, blocuri, float_low, fixed_low)
        except Exception as e: 
            print(f"Eroare citire: {e}")
            time.sleep(interval)
            continue
        t = datetime.now().replace(microsecond=0)
        valori = {c: curata(rez.get(c)) for c in COLOANE}
        try:
            con = con or db.conecteaza()
            with con.transaction():
                con.execute("INSERT INTO masuratori (timp, valori) VALUES (%s, %s)", (t, Jsonb(valori)))
        except psycopg.Error as e:
            # baza a cazut: pierdem doar randul asta, la citirea urmatoare ne reconectam
            print(f"Eroare baza de date: {e}")
            if con:
                con.close()
            con = None
        with lacat:
            ultima["timp"] = t.isoformat()
            ultima["valori"] = valori
        time.sleep(interval)


@app.get("/api/obiecte")
def obiecte():
    rez = [{"nume": n, "adresa": hex(a), "unitate": u, "descriere": d} for n, a, _, u, d in OBIECTE]
    rez.append({"nume": "Durata_viata_%", "adresa": None, "unitate": "%",
                "descriere": "Durata de viata ramasa"})
    return rez


@app.get("/api/curent")
def curent(_: str = Depends(utilizator_curent)):
    with lacat:
        if ultima["timp"] is None:
            raise HTTPException(503, "Nicio citire inca")
        return dict(ultima)


@app.get("/api/istoric")
def istoric(de_la: datetime | None = None, pana_la: datetime | None = None, limita: int = 1000,
            _: str = Depends(utilizator_curent)):
    with db.conecteaza() as con:
        randuri = con.execute(
            "SELECT timp, valori FROM masuratori"
            " WHERE (%(de_la)s::timestamp IS NULL OR timp >= %(de_la)s)"
            " AND (%(pana_la)s::timestamp IS NULL OR timp <= %(pana_la)s)"
            " ORDER BY timp DESC LIMIT %(limita)s",
            {"de_la": de_la, "pana_la": pana_la, "limita": limita}).fetchall()
    return [{"timp": t.isoformat(timespec="seconds"), "valori": v} for t, v in reversed(randuri)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port")
    ap.add_argument("--adresa", type=int, default=2)
    ap.add_argument("--baud", type=int, default=19200)
    ap.add_argument("--paritate", default="E", choices=["E", "O", "N"])
    ap.add_argument("--stopbits", type=int, default=1)
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--http-port", type=int, default=8000)
    a = ap.parse_args()
    a.port = a.port or gaseste_port()

    db.migreaza()
    client = ModbusSerialClient(port=a.port, baudrate=a.baud, parity=a.paritate,
                                stopbits=a.stopbits, bytesize=8, timeout=1)
    if not client.connect():
        raise SystemExit(f"Nu pot deschide portul {a.port}")
    threading.Thread(target=bucla_citire, args=(client, a.adresa, a.interval), daemon=True).start()

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=a.http_port)


if __name__ == "__main__":
    main()
