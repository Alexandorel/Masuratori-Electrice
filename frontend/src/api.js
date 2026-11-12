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
