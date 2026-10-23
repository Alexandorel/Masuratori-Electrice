// Netezire Gaussiana: fiecare punct devine media ponderata a vecinilor, cu ponderi
// w = e^(-d²/2σ²), d = distanta in puncte. Dupa 3σ ponderea e < 1%, deci ne oprim acolo.
// Valorile null (dispozitivul n-a raspuns) sunt sarite si raman goluri.
export function netezeste(valori, sigma) {
  if (!(sigma > 0)) return valori
  const raza = Math.ceil(3 * sigma)
  const ponderi = Array.from({ length: raza + 1 }, (_, d) => Math.exp(-(d * d) / (2 * sigma * sigma)))
  return valori.map((v, i) => {
    if (v == null) return null
    let suma = 0
    let total = 0
    for (let j = Math.max(0, i - raza); j <= Math.min(valori.length - 1, i + raza); j++) {
      if (valori[j] == null) continue
      suma += ponderi[Math.abs(i - j)] * valori[j]
      total += ponderi[Math.abs(i - j)]
    }
    return suma / total  // impartim la suma ponderilor folosite, ca marginile si golurile sa nu traga spre 0
  })
}
