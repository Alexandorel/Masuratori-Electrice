"""
Server HTTP pentru frontend-ul React: citeste unul sau mai multe contoare in fundal,
salveaza fiecare citire in SQLite (masuratori.db) si le expune ca JSON.

Rulare:  python server.py --dispozitiv COM3:2 --dispozitiv COM4:1   (PORT:ADRESA_MODBUS)
         python server.py --demo                                     (2 dispozitive simulate)
Apoi:    cd frontend && npm install && npm run dev   -> http://localhost:5173

Rute:    /api/obiecte                      lista registrelor (nume, unitate, descriere)
         /api/dispozitive                  dispozitivele si starea lor
         /api/date?dispozitiv=COM3:2       ultima citire
         /api/istoric?dispozitiv=COM3:2&de=<unix>&pana=<unix>&registre=IL1,IL2
"""
import argparse
import json
import math
import random
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from citire_contor import OBIECTE, ModbusSerialClient, citeste_tot, construieste_blocuri, ordine_cuvinte

BAZA = "masuratori.db"
MAX_RANDURI = 1000  # peste atat, istoricul se grupeaza in medii pe intervale egale
# registrele numerice au cate o coloana in tabel; raw6 (text) se vede doar live
NUMERICE = [o[0] for o in OBIECTE if o[2] != "raw6"] + ["Durata_viata_%"]
TOATE = [o[0] for o in OBIECTE] + ["Durata_viata_%"]

ultime = {}  # id dispozitiv -> {"timp", "eroare", "valori"}; scris de thread-uri, citit de HTTP


def conectare():
    # timeout: daca alt thread scrie chiar acum, asteptam in loc sa dam eroare
    return sqlite3.connect(BAZA, timeout=10)


def creeaza_tabel():
    coloane = ", ".join(f'"{n}" REAL' for n in NUMERICE)
    with conectare() as c:
        c.execute("PRAGMA journal_mode=WAL")  # permite citiri in timp ce un thread scrie
        c.execute(f"CREATE TABLE IF NOT EXISTS citiri (timp REAL, dispozitiv TEXT, {coloane})")
        c.execute("CREATE INDEX IF NOT EXISTS idx_disp_timp ON citiri (dispozitiv, timp)")


def salveaza(conn, dispozitiv, timp, valori):
    nume = ", ".join(f'"{n}"' for n in NUMERICE)
    semne = ", ".join("?" * (len(NUMERICE) + 2))
    rand = [timp, dispozitiv] + [v if isinstance(v, (int, float)) else None
                                 for v in (valori.get(n) for n in NUMERICE)]
    with conn:
        conn.execute(f"INSERT INTO citiri (timp, dispozitiv, {nume}) VALUES ({semne})", rand)


def istoric(conn, dispozitiv, de, pana, registre):
    """Citirile din [de, pana], grupate in cel mult MAX_RANDURI medii pe intervale de `pas` secunde."""
    pas = max(1, math.ceil((pana - de) / MAX_RANDURI))
    medii = ", ".join(f'AVG("{n}")' for n in registre)
    sql = (f"SELECT CAST(timp / ? AS INTEGER) * ? AS t, {medii} FROM citiri "
           f"WHERE dispozitiv = ? AND timp BETWEEN ? AND ? GROUP BY t ORDER BY t")
    randuri = conn.execute(sql, (pas, pas, dispozitiv, de, pana)).fetchall()
    return {"pas": pas, "randuri": [dict(zip(["timp"] + registre, r)) for r in randuri]}


def bucla_demo(dispozitiv, interval):
    conn = conectare()
    while True:
        valori = {n: round(random.uniform(0, 400), 3) for n in NUMERICE}
        valori["P"] = round(random.uniform(0, 12000), 1)  # ~0-12 kW, ca barele de consum sa treaca prin toate culorile
        ultime[dispozitiv] = {"timp": time.time(), "eroare": None, "valori": valori}
        salveaza(conn, dispozitiv, ultime[dispozitiv]["timp"], valori)
        time.sleep(interval)


def bucla(dispozitiv, port, adresa, a):
    conn = conectare()
    client = ModbusSerialClient(port=port, baudrate=a.baud, parity=a.paritate,
                                stopbits=a.stopbits, bytesize=8, timeout=1)
    while not client.connect():  # adaptorul poate fi conectat mai tarziu
        ultime[dispozitiv] = {**ultime[dispozitiv], "eroare": f"Nu pot deschide portul {port}"}
        time.sleep(5)
    float_low, fixed_low = ordine_cuvinte(client, adresa)
    blocuri = construieste_blocuri()
    while True:
        try:
            valori = citeste_tot(client, adresa, blocuri, float_low, fixed_low)
            if all(v is None for v in valori.values()):
                raise IOError(f"Dispozitivul cu adresa {adresa} nu raspunde")
            ultime[dispozitiv] = {"timp": time.time(), "eroare": None, "valori": valori}
            salveaza(conn, dispozitiv, ultime[dispozitiv]["timp"], valori)
        except Exception as e:  # pastram ultima citire buna, raportam eroarea
            ultime[dispozitiv] = {**ultime[dispozitiv], "eroare": str(e)}
        time.sleep(a.interval)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            corp = self.raspuns(url.path, q)
        except (KeyError, ValueError) as e:  # parametri lipsa sau gresiti
            corp, cod = {"eroare": f"Cerere invalida: {e}"}, 400
        else:
            cod = 200 if corp is not None else 404
        date = json.dumps(corp).encode()
        self.send_response(cod)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(date)))
        self.end_headers()
        self.wfile.write(date)

    def raspuns(self, cale, q):
        if cale == "/api/obiecte":
            obiecte = [{"nume": o[0], "unitate": o[3], "descriere": o[4], "numeric": o[0] in NUMERICE}
                       for o in OBIECTE]
            return obiecte + [{"nume": "Durata_viata_%", "unitate": "%", "descriere": "Durata de viata ramasa",
                               "numeric": True}]
        if cale == "/api/dispozitive":
            return [{"id": d, "timp": u["timp"], "eroare": u["eroare"], "P": u["valori"].get("P")}
                    for d, u in ultime.items()]
        if cale == "/api/date":
            return ultime[q["dispozitiv"]]
        if cale == "/api/istoric":
            registre = [r for r in q["registre"].split(",") if r]
            # numele ajung in SQL ca nume de coloane: acceptam doar registre cunoscute
            necunoscute = [r for r in registre if r not in NUMERICE]
            if necunoscute or not registre:
                raise ValueError(f"registre necunoscute sau lipsa: {necunoscute}")
            with conectare() as conn:
                return istoric(conn, q["dispozitiv"], float(q["de"]), float(q["pana"]), registre)
        return None

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dispozitiv", action="append", default=[], metavar="PORT:ADRESA",
                    help="ex. COM3:2; se poate repeta pentru mai multe dispozitive")
    ap.add_argument("--baud", type=int, default=19200)
    ap.add_argument("--paritate", default="E", choices=["E", "O", "N"])
    ap.add_argument("--stopbits", type=int, default=1)
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--http", type=int, default=8000)
    ap.add_argument("--demo", action="store_true")
    a = ap.parse_args()
    if not a.dispozitiv and not a.demo:
        ap.error("da cel putin un --dispozitiv PORT:ADRESA (sau --demo)")

    creeaza_tabel()
    if a.demo:
        a.dispozitiv = ["DEMO1:1", "DEMO2:2"]
    for d in a.dispozitiv:
        port, _, adresa = d.rpartition(":")
        if not port or not adresa.isdigit():
            ap.error(f"format gresit '{d}', astept PORT:ADRESA (ex. COM3:2)")
        ultime[d] = {"timp": None, "eroare": "Nicio citire inca", "valori": {}}
        tinta, args = (bucla_demo, (d, a.interval)) if a.demo else (bucla, (d, port, int(adresa), a))
        threading.Thread(target=tinta, args=args, daemon=True).start()

    print(f"API pe http://localhost:{a.http}/api/dispozitive")
    ThreadingHTTPServer(("127.0.0.1", a.http), Handler).serve_forever()


if __name__ == "__main__":
    main()
