"""Rulare: python -m unittest test_server"""
import os
import sqlite3
import tempfile
import unittest

import server


class TestIstoric(unittest.TestCase):
    def setUp(self):
        server.BAZA = os.path.join(tempfile.mkdtemp(), "test.db")
        server.creeaza_tabel()
        self.conn = sqlite3.connect(server.BAZA)
        # 10 citiri la 1 s distanta: IL1 = 0, 1, ..., 9
        for i in range(10):
            server.salveaza(self.conn, "COM3:2", 1000 + i, {"IL1": float(i), "Ultima_act": "0001 0002"})
        server.salveaza(self.conn, "COM4:1", 1005, {"IL1": 99.0})

    def tearDown(self):
        self.conn.close()

    def test_fara_grupare(self):
        r = server.istoric(self.conn, "COM3:2", 1000, 1009, ["IL1"])
        self.assertEqual(r["pas"], 1)
        self.assertEqual([x["IL1"] for x in r["randuri"]], [float(i) for i in range(10)])

    def test_grupare_in_medii(self):
        server.MAX_RANDURI = 2  # interval 9 s / 2 randuri -> pas 5 s
        try:
            r = server.istoric(self.conn, "COM3:2", 1000, 1009, ["IL1"])
        finally:
            server.MAX_RANDURI = 1000
        self.assertEqual(r["pas"], 5)
        self.assertEqual(r["randuri"], [{"timp": 1000, "IL1": 2.0}, {"timp": 1005, "IL1": 7.0}])

    def test_dispozitive_separate(self):
        r = server.istoric(self.conn, "COM4:1", 0, 2000, ["IL1"])
        self.assertEqual([x["IL1"] for x in r["randuri"]], [99.0])


if __name__ == "__main__":
    unittest.main()
