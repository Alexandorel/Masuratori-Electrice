export default function AlegeAparat({ aparate, adresa, setAdresa, conectat, stareText }) {
  return (
    <div className="alege-aparat">
      <label htmlFor="aparat" className="eticheta">Aparatul urmărit</label>
      <div className="aparat-rand">
        <select id="aparat" value={adresa} onChange={(e) => setAdresa(Number(e.target.value))}>
          {aparate.map((a) => (
            <option key={a.adresa} value={a.adresa}>{a.nume} · slave {a.adresa}</option>
          ))}
        </select>
        <span className={conectat ? 'stare-ok' : 'stare-rau'}>{stareText}</span>
      </div>
    </div>
  )
}
