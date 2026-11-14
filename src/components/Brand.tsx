/** Identità condivisa da diario, accesso e icona della Home. */
export function Brand() {
  return (
    <span className="brand">
      <img
        className="brand-mark"
        src="/icons/icon-192.png"
        width={48}
        height={48}
        alt=""
      />
      <span className="brand-copy">
        <span className="brand-name">
          fanta<em>folletto</em>
        </span>
        <small>Il diario delle piccole avventure</small>
      </span>
    </span>
  )
}
