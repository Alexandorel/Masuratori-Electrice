"""
Citire date din declansatorul/contorul Eaton PXR prin Modbus RTU (adaptor USB-RS485).
Toate registrele din tabelul 24 (manual MN012005EN, pag. 53-55),
cu formatul de energie pe 4 registre de la pag. 56.

Instalare:   pip install pymodbus pyserial
Rulare:      python citire_contor.py --port COM3          (Windows)
             python citire_contor.py --port /dev/ttyUSB0  (Linux)
Optiuni:     --adresa 2 --baud 19200 --paritate E --interval 2 --csv masuratori.csv
             --scan    cauta adresa dispozitivului 1..247
             --o-data  o singura citire, apoi iese (util pentru test)

Ordinea cuvintelor (pag. 72): 0x07D1 (float) si 0x07D2 (fixed point);
valoare != 0 (implicit) -> cuvantul INFERIOR vine primul. Se citeste automat.
"""
import argparse
import csv
import struct
import time
from datetime import datetime

from pymodbus.client import ModbusSerialClient

# Tipuri:  f32  = IEEE float, 2 registre
#          u16  = 1 registru
#          fx32 = fixed point 32 bit fara semn, 2 registre
#          e4   = energie pe 4 registre (pag. 56)
#          raw6 = 6 registre afisate brut (format nedetaliat in manual)
# (nume, adresa hex, tip, unitate, descriere)
OBIECTE = [
    # ---------------- pag. 53 ----------------
    ("Stare",        0x1200, "u16", "-",   "Cauza starii (H=primara, L=secundara)"),
    ("Cod_cauza",    0x1201, "u16", "-",   "Cod cauza"),
    ("IL1",          0x1202, "f32", "A",   "Curent L1"),
    ("IL2",          0x1204, "f32", "A",   "Curent L2"),
    ("IL3",          0x1206, "f32", "A",   "Curent L3"),
    ("IG",           0x1208, "f32", "A",   "Curent de defect la pamant"),
    ("IN",           0x120A, "f32", "A",   "Curent neutru"),
    ("U12",          0x120E, "f32", "V",   "Tensiune L1-L2"),
    ("U23",          0x1210, "f32", "V",   "Tensiune L2-L3"),
    ("U31",          0x1212, "f32", "V",   "Tensiune L3-L1"),
    ("U1N",          0x1216, "f32", "V",   "Tensiune L1-N"),
    ("U2N",          0x1218, "f32", "V",   "Tensiune L2-N"),
    ("U3N",          0x121A, "f32", "V",   "Tensiune L3-N"),
    ("P",            0x122A, "f32", "W",   "Putere activa trifazata"),
    ("Q",            0x122C, "f32", "var", "Putere reactiva trifazata"),
    ("S",            0x122E, "f32", "VA",  "Putere aparenta trifazata"),
    ("PF",           0x1232, "f32", "-",   "Factor de putere"),
    ("f",            0x1234, "f32", "Hz",  "Frecventa"),
    ("P_cerere_max", 0x1258, "f32", "W",   "Varf cerere putere activa"),
    ("ID_produs",    0x126E, "f32", "-",   "ID produs"),
    ("f_100",        0x1270, "f32", "Hz",  "Frecventa (rezolutie 0.01)"),
    ("Ea_dir_kWh",   0x1872, "fx32", "kWh", "Energie activa directa"),
    ("Ea_inv_kWh",   0x1874, "fx32", "kWh", "Energie activa inversa"),
    ("Ea_tot_kWh",   0x1876, "fx32", "kWh", "Energie activa directa+inversa"),
    ("Es_kVAh",      0x187E, "fx32", "kVAh", "Energie aparenta"),
    ("Ea_dir_Wh",    0x18A0, "e4",  "Wh",  "Energie activa directa"),
    ("Ea_inv_Wh",    0x18A4, "e4",  "Wh",  "Energie activa inversa"),
    ("Ea_tot_Wh",    0x18A8, "e4",  "Wh",  "Energie activa directa+inversa"),
    ("Es_VAh",       0x18B8, "e4",  "VAh", "Energie aparenta"),
    ("Q_cerere_max", 0x12BC, "f32", "var", "Varf cerere putere reactiva"),
    ("S_cerere_max", 0x12BE, "f32", "VA",  "Varf cerere putere aparenta"),
    ("P_cerere",     0x12EC, "f32", "W",   "Cerere putere activa"),
    ("Q_cerere",     0x12EE, "f32", "var", "Cerere putere reactiva"),
    ("S_cerere",     0x12F0, "f32", "VA",  "Cerere putere aparenta"),
    # ---------------- pag. 54 ----------------
    ("IL1_min",      0x12F2, "f32", "A",   "Minim IL1"),
    ("IL1_max",      0x12F4, "f32", "A",   "Maxim IL1"),
    ("IL2_min",      0x12F6, "f32", "A",   "Minim IL2"),
    ("IL2_max",      0x12F8, "f32", "A",   "Maxim IL2"),
    ("IL3_min",      0x12FA, "f32", "A",   "Minim IL3"),
    ("IL3_max",      0x12FC, "f32", "A",   "Maxim IL3"),
    ("IG_min",       0x12FE, "f32", "A",   "Minim IG"),
    ("IG_max",       0x1300, "f32", "A",   "Maxim IG"),
    ("IN_min",       0x1302, "f32", "A",   "Minim IN"),
    ("IN_max",       0x1304, "f32", "A",   "Maxim IN"),
    ("U1_min",       0x1306, "f32", "V",   "Minim UL1"),
    ("U1_max",       0x1308, "f32", "V",   "Maxim UL1"),
    ("U2_min",       0x130A, "f32", "V",   "Minim UL2"),
    ("U2_max",       0x130C, "f32", "V",   "Maxim UL2"),
    ("U3_min",       0x130E, "f32", "V",   "Minim UL3"),
    ("U3_max",       0x1310, "f32", "V",   "Maxim UL3"),
    ("U1N_min",      0x1312, "f32", "V",   "Minim UL1-N"),
    ("U1N_max",      0x1314, "f32", "V",   "Maxim UL1-N"),
    ("U2N_min",      0x1316, "f32", "V",   "Minim UL2-N"),
    ("U2N_max",      0x1318, "f32", "V",   "Maxim UL2-N"),
    ("U3N_min",      0x131A, "f32", "V",   "Minim UL3-N"),
    ("U3N_max",      0x131C, "f32", "V",   "Maxim UL3-N"),
    ("Prealarma_supr", 0x131E, "f32", "%", "Prealarma suprasarcina"),
    ("Nr_decl_Isd_Ii", 0x135E, "f32", "-", "Contor declansari Isd, Ii"),
    ("Nr_decl_Ir_Ig",  0x1360, "f32", "-", "Contor declansari Ir, Ig"),
    ("Nr_manevre",     0x1362, "f32", "-", "Contor manevre"),
    ("Nr_decl_Isd",    0x1364, "f32", "-", "Contor declansari Isd"),
    ("Nr_decl_Ii",     0x1366, "f32", "-", "Contor declansari Ii"),
    ("Nr_decl_bypass", 0x1368, "f32", "-", "Contor declansari bypass"),
    ("Nr_decl_Ir",     0x136A, "f32", "-", "Contor declansari Ir"),
    ("Nr_decl_Ig",     0x136C, "f32", "-", "Contor declansari Ig"),
    ("Nr_decl_total",  0x136E, "f32", "-", "Total declansari"),
    ("Nr_decl_test",   0x1370, "f32", "-", "Declansari in mod test"),
    ("Nr_desch_com",   0x1372, "f32", "-", "Deschideri prin interfata de comunicatie"),
    # ---------------- pag. 55 ----------------
    ("Nr_act_ext",     0x1374, "f32", "-",   "Actionari externe"),
    ("Ultima_act",     0x1376, "raw6", "-",  "Ultima actionare (an, luna, zi, ora, min, sec)"),
    ("Timp_func_min",  0x1390, "f32", "min", "Timp de functionare (minute)"),
    ("Timp_func_h",    0x1392, "f32", "h",   "Timp de functionare (ore)"),
    ("Timp_func_zile", 0x1394, "f32", "d",   "Timp de functionare (zile)"),
    ("Durata_viata",   0x1396, "f32", "pct", "Durata de viata ramasa (puncte)"),
]
LUNGIME = {"u16": 1, "f32": 2, "fx32": 2, "e4": 4, "raw6": 6}
MAX_BLOC = 120   # PXR accepta max. 122 registre / cerere
GOL_MAX = 8      # unim obiecte separate de cel mult 8 registre libere


def citeste(client, adresa, count, unit):
    """Compatibil cu pymodbus 3.x vechi (slave=) si nou (device_id=)."""
    try:
        rr = client.read_holding_registers(adresa, count=count, device_id=unit)
    except TypeError:
        rr = client.read_holding_registers(adresa, count=count, slave=unit)
    return None if rr.isError() else rr.registers


def u32(r0, r1, low_first):
    lo, hi = (r0, r1) if low_first else (r1, r0)
    return (hi << 16) | lo


def f32(r0, r1, low_first):
    return struct.unpack(">f", struct.pack(">I", u32(r0, r1, low_first)))[0]


def energie_4reg(r):
    """Pag. 56: Energie = 2^a x mantisa_48bit x 10^b."""
    mantisa = r[0] | (r[1] << 16) | (r[2] << 32)
    a = (r[3] >> 8) & 0xFF
    b = r[3] & 0xFF
    if b > 127:
        b -= 256
    return (2 ** a) * mantisa * (10 ** b)


def decodeaza(tip, r, float_low, fixed_low):
    if tip == "u16":
        return r[0]
    if tip == "f32":
        return f32(r[0], r[1], float_low)
    if tip == "fx32":
        return u32(r[0], r[1], fixed_low)
    if tip == "e4":
        return energie_4reg(r)
    if tip == "raw6":
        return " ".join(f"{x:04X}" for x in r)


def construieste_blocuri():
    """Grupeaza obiectele apropiate ca sa facem mai putine cereri pe magistrala."""
    obj = sorted(OBIECTE, key=lambda o: o[1])
    blocuri, curent = [], [obj[0]]
    for o in obj[1:]:
        start = curent[0][1]
        sf_prec = curent[-1][1] + LUNGIME[curent[-1][2]]
        sf_nou = o[1] + LUNGIME[o[2]]
        if o[1] - sf_prec <= GOL_MAX and sf_nou - start <= MAX_BLOC:
            curent.append(o)
        else:
            blocuri.append(curent)
            curent = [o]
    blocuri.append(curent)
    return blocuri


def citeste_tot(client, unit, blocuri, float_low, fixed_low):
    rez = {}
    for bloc in blocuri:
        start = bloc[0][1]
        count = bloc[-1][1] + LUNGIME[bloc[-1][2]] - start
        r = citeste(client, start, count, unit)
        for nume, adr, tip, _, _ in bloc:
            n = LUNGIME[tip]
            if r is not None:
                parte = r[adr - start: adr - start + n]
            else:
                # blocul a fost refuzat (obiect invalid in gol) -> citim individual
                parte = citeste(client, adr, n, unit)
            rez[nume] = None if parte is None else decodeaza(tip, parte, float_low, fixed_low)
    # marime derivata (nota 3, pag. 55)
    if isinstance(rez.get("Durata_viata"), float):
        rez["Durata_viata_%"] = 100 - rez["Durata_viata"] / 100
    return rez


def ordine_cuvinte(client, unit):
    r = citeste(client, 0x07D1, 2, unit)
    if r is None:
        print("Nu pot citi ordinea cuvintelor; folosesc valoarea implicita (LOW primul).")
        return True, True
    print(f"Ordine cuvinte: float {'LOW' if r[0] else 'HIGH'} primul, "
          f"fixed {'LOW' if r[1] else 'HIGH'} primul")
    return r[0] != 0, r[1] != 0


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.3f}"
    return str(v)


def afiseaza(rez):
    unit = {o[0]: o[3] for o in OBIECTE}
    unit["Durata_viata_%"] = "%"
    descr = {o[0]: o[4] for o in OBIECTE}
    descr["Durata_viata_%"] = "Durata de viata ramasa"
    for nume in [o[0] for o in OBIECTE] + ["Durata_viata_%"]:
        if nume not in rez:
            continue
        v = rez[nume]
        print(f"  {descr[nume]:<45} {nume:<16} {fmt(v) or '—':>14} {unit[nume]}")


def scan(client):
    print("Caut dispozitive (poate dura)...")
    for unit in range(1, 248):
        if citeste(client, 0x1202, 2, unit) is not None:
            print(f"  Raspuns de la adresa {unit}")
    print("Scanare terminata.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True)
    ap.add_argument("--adresa", type=int, default=2)
    ap.add_argument("--baud", type=int, default=19200)
    ap.add_argument("--paritate", default="E", choices=["E", "O", "N"])
    ap.add_argument("--stopbits", type=int, default=1)
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--csv", default="masuratori.csv")
    ap.add_argument("--scan", action="store_true")
    ap.add_argument("--o-data", action="store_true")
    a = ap.parse_args()

    client = ModbusSerialClient(port=a.port, baudrate=a.baud, parity=a.paritate,
                                stopbits=a.stopbits, bytesize=8, timeout=1)
    if not client.connect():
        raise SystemExit(f"Nu pot deschide portul {a.port}")
    if a.scan:
        scan(client)
        client.close()
        return

    float_low, fixed_low = ordine_cuvinte(client, a.adresa)
    blocuri = construieste_blocuri()
    coloane = [o[0] for o in OBIECTE] + ["Durata_viata_%"]

    with open(a.csv, "a", newline="") as f:
        w = csv.writer(f)
        if f.tell() == 0:
            w.writerow(["timp"] + coloane)
        print(f"Citesc de la adresa {a.adresa}. Ctrl+C pentru oprire.")
        try:
            while True:
                rez = citeste_tot(client, a.adresa, blocuri, float_low, fixed_low)
                t = datetime.now().isoformat(timespec="seconds")
                w.writerow([t] + [fmt(rez.get(c)) for c in coloane])
                f.flush()
                print(f"\n=== {t} ===")
                afiseaza(rez)
                if a.o_data:
                    break
                time.sleep(a.interval)
        except KeyboardInterrupt:
            pass
    client.close()


if __name__ == "__main__":
    main()