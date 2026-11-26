// Adresa serverului FastAPI; se poate schimba din fisierul .env cu VITE_API_URL=...
const BAZA = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function cere(cale) {
  const r = await fetch(BAZA + cale)
  if (!r.ok) throw new Error(`${cale}: ${r.status}`)
  return r.json()
}

// [{nume, adresa, unitate, descriere}]
export const obiecte = () => cere('/api/obiecte')

// {timp, valori: {P: ..., U1N: ...}}; 503 cat timp serverul n-a citit nimic
export const curent = () => cere('/api/curent')

// [{timp, valori}] intre doua momente "YYYY-MM-DDTHH:MM" (ora locala, ca in CSV)
// shortcut: cerem toate randurile din interval; pe 30 de zile la 2 s sunt ~1,3 mil. -> backend-ul ar trebui sa le rareasca
export const istoric = (deLa, panaLa) =>
  cere(`/api/istoric?de_la=${encodeURIComponent(deLa)}&pana_la=${encodeURIComponent(panaLa)}&limita=10000000`)

// Cerere HTTP pentru autentificare; ataseaza automat token-ul din localStorage daca exista.
async function cereAuth(cale, metoda = 'GET', corp = null) {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const r = await fetch(BAZA + cale, {
    method: metoda,
    headers,
    body: corp ? JSON.stringify(corp) : null,
  })
  const date = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(date.detail || `Eroare ${r.status}`)
  return date
}

// Creeaza un cont nou: {mesaj, username}
export const register = (username, parola) =>
  cereAuth('/api/auth/register', 'POST', { username, parola })

// Autentifica utilizatorul si intoarce {token, username}
export const login = (username, parola) =>
  cereAuth('/api/auth/login', 'POST', { username, parola })

// Verifica sesiunea curenta la incarcarea paginii: {username}
export const me = () => cereAuth('/api/auth/me')

// Inchide sesiunea pe server
export const logout = () => cereAuth('/api/auth/logout', 'POST')