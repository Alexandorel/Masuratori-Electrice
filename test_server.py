"""Rulare: python test_server.py  (fara hardware: Modbus e inlocuit cu registre false)"""
import os
import struct
import tempfile

from fastapi.testclient import TestClient

import citire_contor
import server


class Stop(Exception):
    pass


def registre_false(client, adresa, count, unit):
    if adresa == 0x07D1:
        return [1, 1]
    hi, lo = struct.unpack(">HH", struct.pack(">f", 230.5))
    return [lo, hi] * (count // 2) + [0] * (count % 2)


def test():
    citire_contor.citeste = registre_false
    server.CSV_PATH = os.path.join(tempfile.mkdtemp(), "m.csv")
    c = TestClient(server.app)
    assert c.get("/api/curent").status_code == 503
    assert c.get("/api/istoric").json() == []

    server.time.sleep = lambda s: (_ for _ in ()).throw(Stop())
    try:
        server.bucla_citire(None, 2, 0)
    except Stop:
        pass

    cur = c.get("/api/curent").json()
    assert cur["timp"] and len(cur["valori"]) == len(server.COLOANE)
    ist = c.get("/api/istoric", params={"de_la": "2000-01-01"}).json()
    assert len(ist) == 1 and ist[0]["valori"].keys() == cur["valori"].keys()
    assert c.get("/api/istoric", params={"de_la": "2999-01-01"}).json() == []
    assert len(c.get("/api/obiecte").json()) == len(server.COLOANE)
    assert server.curata(float("nan")) is None and server.numar("nan") is None
    print("OK", cur["valori"]["IL1"], ist[0]["valori"]["IL1"])


if __name__ == "__main__":
    test()
