import { Component, type ReactNode } from 'react'

export class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app">
        <section className="panel loading-state">
          <h1>Riapriamo questa pagina</h1>
          <p>
            Non riesco a caricare una parte del diario. I dati già salvati sul
            dispositivo non sono stati cancellati. Controlla la connessione e
            riprova.
          </p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Riapri il diario
          </button>
        </section>
      </div>
    )
  }
}
