"""Parolele nu se salveaza in clar, ci ca hash PBKDF2-SHA256 cu salt unic per utilizator."""
import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

DB_PATH = "utilizatori.db"
router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_db():
    """Deschide conexiunea la SQLite si returneaza randurile ca dictionare (acces dupa numele coloanei)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Creeaza tabelele la pornirea serverului daca nu exista deja."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS utilizatori (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                parola_hash TEXT NOT NULL,
                salt TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sesiuni (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                creat_la TEXT NOT NULL
            )
        """)


init_db()


def hash_parola(parola: str, salt: str) -> str:
    """Genereaza hash-ul parolei folosind 100.000 de iteratii PBKDF2-SHA256."""
    return hashlib.pbkdf2_hmac("sha256", parola.encode(), salt.encode(), 100_000).hex()


class DateAuth(BaseModel):
    """Schema JSON asteptata de la frontend pentru /register si /login."""
    username: str
    parola: str


@router.post("/register", status_code=201)
def register(date: DateAuth):
    username = date.username.strip()
    if len(username) < 3:
        raise HTTPException(400, "Numele de utilizator trebuie sa aiba minim 3 caractere.")
    if len(date.parola) < 6:
        raise HTTPException(400, "Parola trebuie sa aiba minim 6 caractere.")

    # Salt aleatoriu de 16 octeti (32 caractere hex) pentru fiecare cont nou.
    salt = secrets.token_hex(16)
    parola_hash = hash_parola(date.parola, salt)

    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO utilizatori (username, parola_hash, salt) VALUES (?, ?, ?)",
                (username, parola_hash, salt),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Acest nume de utilizator exista deja.")

    return {"mesaj": "Cont creat cu succes.", "username": username}


@router.post("/login")
def login(date: DateAuth):
    username = date.username.strip()
    with get_db() as conn:
        user = conn.execute(
            "SELECT username, parola_hash, salt FROM utilizatori WHERE username = ?",
            (username,),
        ).fetchone()

        # compare_digest previne atacurile de tip timing la verificarea hash-ului.
        if not user or not hmac.compare_digest(hash_parola(date.parola, user["salt"]), user["parola_hash"]):
            raise HTTPException(401, "Utilizator sau parola incorecta.")

        # Generam un token de sesiune si il salvam in baza de date.
        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sesiuni (token, username, creat_la) VALUES (?, ?, ?)",
            (token, user["username"], datetime.now().isoformat(timespec="seconds")),
        )

    return {"token": token, "username": user["username"]}


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    """Verifica daca token-ul din header-ul 'Authorization: Bearer <token>' este valid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Neautentificat.")
    token = authorization.removeprefix("Bearer ").strip()

    with get_db() as conn:
        sesiune = conn.execute(
            "SELECT username FROM sesiuni WHERE token = ?", (token,)
        ).fetchone()

    if not sesiune:
        raise HTTPException(401, "Sesiune expirata sau invalida.")
    return {"username": sesiune["username"]}


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    """Sterge sesiunea curenta din baza de date (invalideaza token-ul)."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        with get_db() as conn:
            conn.execute("DELETE FROM sesiuni WHERE token = ?", (token,))
    return {"mesaj": "Delogat cu succes."}