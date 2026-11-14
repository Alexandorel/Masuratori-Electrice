// Graficele din sectiunea "Cum a evoluat".
// Primeste:
//   date     – [{timp, valori: {P: ..., U1N: ...}}] din /api/istoric, pentru aparatul si intervalul alese
//   registre – codurile de afisat (ex. ['P', 'U1N']); in modul Simplu doar ['P']
//   obiecte  – lista din /api/obiecte, grupata ([{cod, nume, unitate}]), pentru nume si unitati
// Nu stie nimic de Modbus sau de slave-uri: deseneaza ce primeste, deci merge la fel pentru orice aparat.
import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { format } from '../registre'
import { consum, grupeazaPeUnitati, pasConsum, puncte, rareste } from '../grafice'

// Paleta categoriala validata pentru daltonism (ordine fixa); prima serie are culoarea de accent a aplicatiei.
const CULORI = ['#1D5BD8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const AXA = { stroke: '#566273', fontSize: 13, tickLine: false } // --text-slab din App.css
const GRILA = '#E3E7ED' // --linie
const ZI = 86400000

const ora = (t) => new Date(t).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
const ziSiOra = (t) => new Date(t).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function LocGrafic({ date, registre, obiecte = [] }) {
  const nume = Object.fromEntries(obiecte.map((o) => [o.cod, o.nume]))
  // Recalculam doar cand vin date noi sau se schimba registrele, nu la fiecare citire "curent" (la 2 s).
  const linii = useMemo(() => puncte(rareste(date), registre), [date, registre])
  const pas = pasConsum(date)
  const bare = useMemo(() => consum(date, pas), [date, pas])

  if (date.length === 0) return <div className="gol">Nu sunt citiri în perioada aleasă.</div>

  const durata = linii.at(-1).t - linii[0].t
  // sub o ora aratam si secundele, altfel etichetele s-ar repeta ("22:07, 22:07, ...")
  const etichetaX = durata > ZI ? ziSiOra : durata < 3600000 ? (t) => new Date(t).toLocaleTimeString('ro-RO') : ora
  const totalKWh = bare.reduce((s, b) => s + b.kWh, 0)

  return (
    <div className="grafice">
      {bare.length > 0 && (
        <figure className="grafic">
          <figcaption>
            <h3>Consum pe {pas === 'zi' ? 'zi' : 'oră'} <span className="unitate">kWh</span></h3>
            <span className="text-slab mic">Total: {format(totalKWh, 2)} kWh</span>
          </figcaption>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bare} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRILA} />
              <XAxis dataKey="cheie" {...AXA} tickFormatter={(c) => etichetaBara(c, pas)} minTickGap={16} />
              <YAxis {...AXA} width={56} axisLine={false} tickFormatter={(v) => format(v, 3)} />
              <Tooltip cursor={{ fill: '#EEF1F5' }} labelFormatter={(c) => etichetaBara(c, pas, true)}
                formatter={(v) => [`${format(v, 3)} kWh`, 'Consum']} />
              <Bar dataKey="kWh" fill={CULORI[0]} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </figure>
      )}

      {registre.length === 0 && (
        <div className="gol">Nicio mărime aleasă. Bifează „Pe grafic” în secțiunea Registre.</div>
      )}

      {/* un grafic pe unitate de masura: o singura axa Y, deci V si A nu se amesteca */}
      {grupeazaPeUnitati(registre, obiecte).map(({ unitate, coduri }) => (
        <figure key={unitate} className="grafic">
          <figcaption>
            <h3>{coduri.map((c) => nume[c] ?? c).join(', ')} {unitate && <span className="unitate">{unitate}</span>}</h3>
          </figcaption>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={linii} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRILA} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
                {...AXA} tickFormatter={etichetaX} minTickGap={48} />
              <YAxis {...AXA} width={56} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => format(v, 1)} />
              <Tooltip labelFormatter={ziSiOra} formatter={(v, c) => [`${format(v)} ${unitate}`, nume[c] ?? c]} />
              {coduri.length > 1 && <Legend formatter={(c) => nume[c] ?? c} wrapperStyle={{ fontSize: 14 }} />}
              {coduri.map((c, i) => (
                // fara animatie: istoricul se reincarca si linia ar "sari" de fiecare data
                <Line key={c} dataKey={c} stroke={CULORI[i % CULORI.length]} strokeWidth={2} dot={false}
                  activeDot={{ r: 4 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </figure>
      ))}
    </div>
  )
}

// "2026-11-12T10" -> "10:00" (sau "12.11 10:00" in tooltip); "2026-11-12" -> "12.11"
function etichetaBara(cheie, pas, lung = false) {
  const [an, luna, zi] = cheie.slice(0, 10).split('-')
  if (pas === 'zi') return lung ? `${zi}.${luna}.${an}` : `${zi}.${luna}`
  const h = `${cheie.slice(11, 13)}:00`
  return lung ? `${zi}.${luna} ${h}–${cheie.slice(11, 13)}:59` : h
}
