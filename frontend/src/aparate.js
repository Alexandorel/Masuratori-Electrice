// Aparatele (slave-urile Modbus) afisate in lista "Aparatul urmarit".
//
// Deocamdata backend-ul citeste UN singur aparat (server.py --adresa 2), deci lista are un element.
// Ca sa suportam mai multe aparate pe aceeasi magistrala RS-485, la backend trebuie:
//   1. server.py sa primeasca mai multe adrese (ex. --adrese 2 3 4) si sa le citeasca pe rand
//      in bucla_citire, cu acelasi client serial (portul nu poate fi deschis de doua ori);
//   2. `ultima` sa fie un dictionar pe adresa: {2: {timp, valori}, 3: {...}};
//   3. CSV separat per aparat sau o coloana "adresa" in masuratori.csv;
//   4. endpoint-urile sa primeasca adresa: /api/curent?adresa=3, /api/istoric?adresa=3&...,
//      plus un /api/aparate care spune ce aparate exista si cand au raspuns ultima data.
// Dupa asta, lista de mai jos poate veni din /api/aparate, iar api.js trimite `adresa` la fiecare cerere.
export const APARATE = [
  { adresa: 2, nume: 'Întrerupător general' },
]
