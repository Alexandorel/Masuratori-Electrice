import argparse
import csv
import math
import os
import threading
import time
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymodbus.client import ModbusSerialClient

from citire_contor import OBIECTE, citeste_tot, construieste_blocuri, fmt, ordine_cuvinte

COLOANE = [o[0] for o in OBIECTE] + ["Durata_viata_%"]
CSV_PATH = "masuratori.csv"

app = FastAPI(title="Contor Eaton PXR")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])

ultima = {"timp": None, "valori": None}
lacat = threading.Lock()


def curata(v):
    """NaN/inf nu sunt JSON valid -> None."""
    return None if isinstance(v, float) and not math.isfinite(v) else v


def numar(s):
    if s == "":
        return None
    try:
        return curata(float(s))
    except ValueError:
        return s


def bucla_citire(client, unit, interval):
    float_low, fixed_low = ordine_cuvinte(client, unit)
    blocuri = construieste_blocuri()
    with open(CSV_PATH, "a", newline="") as f:
        w = csv.writer(f)
        if f.tell() == 0:
            w.writerow(["timp"] + COLOANE)
        while True:
            try:
                rez = citeste_tot(client, unit, blocuri, float_low, fixed_low)
            except Exception as e: 
                print(f"Eroare citire: {e}")
                time.sleep(interval)
                continue
            t = datetime.now().isoformat(timespec="seconds")
            w.writerow([t] + [fmt(rez.get(c)) for c in COLOANE])
            f.flush()
            with lacat:
                ultima["timp"] = t
                ultima["valori"] = {c: curata(rez.get(c)) for c in COLOANE}
            time.sleep(interval)


@app.get("/api/obiecte")
def obiecte():
    rez = [{"nume": n, "adresa": hex(a), "unitate": u, "descriere": d} for n, a, _, u, d in OBIECTE]
    rez.append({"nume": "Durata_viata_%", "adresa": None, "unitate": "%",
                "descriere": "Durata de viata ramasa"})
    return rez


@app.get("/api/curent")
def curent():
    with lacat:
        if ultima["timp"] is None:
            raise HTTPException(503, "Nicio citire inca")
        return dict(ultima)


@app.get("/api/istoric")
def istoric(de_la: str | None = None, pana_la: str | None = None, limita: int = 1000):
    if not os.path.exists(CSV_PATH):
        return []
    rez = []
    with open(CSV_PATH, newline="") as f:
        for r in csv.DictReader(f):
            t = r.pop("timp")
            # comparatia de siruri e cronologica
            if (de_la and t < de_la) or (pana_la and t > pana_la):
                continue
            rez.append({"timp": t, "valori": {k: numar(v or "") for k, v in r.items()}})
    return rez[-limita:]


def main():
    global CSV_PATH
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True)
    ap.add_argument("--adresa", type=int, default=2)
    ap.add_argument("--baud", type=int, default=19200)
    ap.add_argument("--paritate", default="E", choices=["E", "O", "N"])
    ap.add_argument("--stopbits", type=int, default=1)
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--csv", default=CSV_PATH)
    ap.add_argument("--http-port", type=int, default=8000)
    a = ap.parse_args()
    CSV_PATH = a.csv

    client = ModbusSerialClient(port=a.port, baudrate=a.baud, parity=a.paritate,
                                stopbits=a.stopbits, bytesize=8, timeout=1)
    if not client.connect():
        raise SystemExit(f"Nu pot deschide portul {a.port}")
    threading.Thread(target=bucla_citire, args=(client, a.adresa, a.interval), daemon=True).start()

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=a.http_port)


if __name__ == "__main__":
    main()
