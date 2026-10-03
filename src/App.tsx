import { Suspense, useEffect, useMemo, useState } from 'react'
import { StoreProvider, useGameState, useGameDispatch } from './state/store'
import { useAudioSync } from './audio/useAudioSync'
import { repository } from './data/repository'
import type { Album } from './data/schema'
import { Scene } from './scene/Scene'

const overlay = { position: 'absolute', zIndex: 100, fontFamily: 'monospace', color: '#fff' } as const

function Game({ albums }: { albums: Album[] }) {
  const s = useGameState(), dispatch = useGameDispatch()
  const byId = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums])
  useAudioSync(byId)

  // "LOADING" dura un attimo, poi lo stereo è pronto
  useEffect(() => {
    if (s.player !== 'loading') return
    const t = setTimeout(() => dispatch({ type: 'LOADED' }), 1800)
    return () => clearTimeout(t)
  }, [s.player, dispatch])

  return (
    <>
      <div id="debug-panel" style={{ ...overlay, top: 10, right: 10, color: '#0f0', background: '#000c', padding: 15, whiteSpace: 'pre-wrap', border: '1px solid #0f0' }} />
      {s.view === 'stereo' && (
        <button onClick={() => dispatch({ type: 'GO_CASE' })}
          style={{ ...overlay, top: 10, left: 10, padding: '10px 16px', background: '#000c', border: '1px solid #fff5', borderRadius: 6, cursor: 'pointer' }}>
          ← Indietro
        </button>
      )}
      <Suspense fallback={<div style={{ ...overlay, top: '50%', left: '50%' }}>Caricamento…</div>}>
        <Scene albums={albums} />
      </Suspense>
    </>
  )
}

export default function App() {
  const [albums, setAlbums] = useState<Album[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    repository.list().then(setAlbums).catch((e) => setError(String(e)))
  }, [])

  if (error) return <pre style={{ ...overlay, top: 20, left: 20 }}>Catalogo non valido:{'\n'}{error}</pre>
  if (!albums) return <div style={{ ...overlay, top: 20, left: 20 }}>Caricamento catalogo…</div>
  return <StoreProvider><Game albums={albums} /></StoreProvider>
}
