export default function Antet({ stare, mod, setMod }) {
  return (
    <header className="antet">
      <div className="pagina antet-rand">
        <div>
          <div className="antet-titlu">Monitorizare energie</div>
          <div className="text-slab mic">{stare}</div>
        </div>
        <div className="segment" role="group" aria-label="Mod de afișare">
          <button type="button" aria-pressed={mod === 'simplu'} onClick={() => setMod('simplu')}>Simplu</button>
          <button type="button" aria-pressed={mod === 'detaliat'} onClick={() => setMod('detaliat')}>Detaliat</button>
        </div>
      </div>
    </header>
  )
}
