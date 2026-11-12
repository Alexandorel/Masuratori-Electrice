"""Server demo, fara aparat: aceleasi endpoint-uri ca server.py, dar cu valori false care se schimba.
Rulare: python server_demo.py  ->  http://localhost:8000/docs
Istoricul se scrie intr-un CSV temporar, ca sa nu amestece date false in masuratori.csv."""
import math
import os
import random
import tempfile
import threading
import time

import uvicorn

import server

PORNIRE = time.time()


def valori_false(*_):
    """Inlocuieste citeste_tot: intoarce un dictionar {nume: valoare}, ca citirea reala."""
    t = time.time() - PORNIRE
    # Sarcina urca si coboara lent (un ciclu la ~5 minute), plus putin zgomot.
    sarcina = 0.6 + 0.3 * math.sin(t / 50) + random.uniform(-0.05, 0.05)
    i1, i2, i3 = (round(12 * sarcina * k, 2) for k in (1.0, 0.85, 1.4))  # L3 mai incarcata
    u1, u2, u3 = (round(230 + random.uniform(-3, 3), 1) for _ in range(3))
    pf = round(0.95 + random.uniform(-0.02, 0.02), 3)
    s = u1 * i1 + u2 * i2 + u3 * i3
    p = s * pf
    energie = 10096 + t * 3.5 / 3600  # ~3,5 kW in medie

    rez = {c: 0.0 for c in server.COLOANE}
    rez.update({
        "IL1": i1, "IL2": i2, "IL3": i3, "IN": round(abs(i3 - i1) * 0.5, 2),
        "U1N": u1, "U2N": u2, "U3N": u3,
        "U12": round(u1 * math.sqrt(3), 1), "U23": round(u2 * math.sqrt(3), 1), "U31": round(u3 * math.sqrt(3), 1),
        "P": round(p, 1), "S": round(s, 1), "Q": round(math.sqrt(max(s * s - p * p, 0)), 1), "PF": pf,
        "f": round(50 + random.uniform(-0.05, 0.05), 2),
        "P_cerere": round(p * 0.97, 1), "P_cerere_max": 9612.0,
        "Ea_dir_kWh": round(energie, 3), "Ea_tot_kWh": round(energie, 3), "Es_kVAh": round(energie * 1.04, 3),
        "Timp_func_h": 15 + t / 3600, "Durata_viata_%": 100.0,
    })
    return rez


def main():
    server.ordine_cuvinte = lambda client, unit: (True, True)  # nu exista aparat de interogat
    server.citeste_tot = valori_false
    server.CSV_PATH = os.path.join(tempfile.mkdtemp(), "demo.csv")
    threading.Thread(target=server.bucla_citire, args=(None, 2, 2.0), daemon=True).start()
    uvicorn.run(server.app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
