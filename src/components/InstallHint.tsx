export function InstallHint() {
  const standalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone
  if (standalone) return null
  return (
    <details className="install-hint">
      <summary>Porta il diario sulla Home</summary>
      <p>
        Su iPhone apri questo sito in Safari, tocca Condividi e scegli “Aggiungi
        alla schermata Home”. Poi apri l’icona e accedi da lì: la sessione può
        essere diversa da quella di Safari.
      </p>
      <p>
        Per preparare l’uso senza rete, apri il diario dalla Home almeno una
        volta online e attendi il caricamento.
      </p>
    </details>
  )
}
