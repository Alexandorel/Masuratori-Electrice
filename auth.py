"""Parolele nu se salveaza in clar, ci ca hash PBKDF2-SHA256 cu salt unic per utilizator."""
import hashlib
import hmac
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel

import db

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
        with db.conecteaza() as conn:
            conn.execute(
                "INSERT INTO utilizatori (username, parola_hash, salt) VALUES (%s, %s, %s)",
                (username, parola_hash, salt),
            )
    except UniqueViolation:
        raise HTTPException(409, "Acest nume de utilizator exista deja.")

    return {"mesaj": "Cont creat cu succes.", "username": username}


@router.post("/login")
def login(date: DateAuth):
    username = date.username.strip()
    with db.conecteaza() as conn:
        user = conn.cursor(row_factory=dict_row).execute(
            "SELECT username, parola_hash, salt FROM utilizatori WHERE username = %s",
            (username,),
        ).fetchone()

        # compare_digest previne atacurile de tip timing la verificarea hash-ului.
        if not user or not hmac.compare_digest(hash_parola(date.parola, user["salt"]), user["parola_hash"]):
            raise HTTPException(401, "Utilizator sau parola incorecta.")

        # Generam un token de sesiune si il salvam in baza de date.
        token = secrets.token_hex(32)
        conn.execute(
            "INSERT INTO sesiuni (token, username, creat_la) VALUES (%s, %s, %s)",
            (token, user["username"], datetime.now().replace(microsecond=0)),
        )

    return {"token": token, "username": user["username"]}


def utilizator_curent(authorization: str | None = Header(default=None)) -> str:
    """Verifica daca token-ul din header-ul 'Authorization: Bearer <token>' este valid; intoarce username-ul."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Neautentificat.")
    token = authorization.removeprefix("Bearer ").strip()

    with db.conecteaza() as conn:
        sesiune = conn.execute(
            "SELECT username FROM sesiuni WHERE token = %s", (token,)
        ).fetchone()

    if not sesiune:
        raise HTTPException(401, "Sesiune expirata sau invalida.")
    return sesiune[0]


@router.get("/me")
def me(username: str = Depends(utilizator_curent)):
    return {"username": username}


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    """Sterge sesiunea curenta din baza de date (invalideaza token-ul)."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        with db.conecteaza() as conn:
            conn.execute("DELETE FROM sesiuni WHERE token = %s", (token,))
    return {"mesaj": "Delogat cu succes."}