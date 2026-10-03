// Reducer PURO: nessun import da React, three o dai dati. Si testa senza browser.
export type View = 'case' | 'stereo'
export type DiscPlace = 'hand' | 'tray' | 'loaded'
export type PlayerStatus = 'idle' | 'loading' | 'stopped' | 'playing' | 'paused'

export interface Disc { albumId: string; place: DiscPlace; trackCount: number }
export interface State { view: View; disc: Disc | null; trayOpen: boolean; player: PlayerStatus; track: number }

export type Action =
  | { type: 'GO_STEREO' } | { type: 'GO_CASE' }
  | { type: 'GRAB'; albumId: string; trackCount: number } | { type: 'RETURN' }
  | { type: 'PUT_ON_TRAY' } | { type: 'PICK_FROM_TRAY' } | { type: 'TOGGLE_TRAY' } | { type: 'LOADED' }
  | { type: 'PLAY' } | { type: 'STOP' } | { type: 'NEXT' } | { type: 'PREV' } | { type: 'TRACK_ENDED' }

export const initialState: State = { view: 'case', disc: null, trayOpen: false, player: 'idle', track: 0 }

const hasDisc = (s: State) => s.player === 'stopped' || s.player === 'playing' || s.player === 'paused'

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'GO_STEREO': return { ...s, view: 'stereo' }
    case 'GO_CASE': return { ...s, view: 'case' }

    case 'GRAB':
      return s.disc ? s : { ...s, disc: { albumId: a.albumId, place: 'hand', trackCount: a.trackCount } }
    case 'RETURN':
      return s.disc?.place === 'hand' && s.view === 'case' ? { ...s, disc: null } : s

    case 'PUT_ON_TRAY':
      return s.disc?.place === 'hand' && s.view === 'stereo' && s.trayOpen
        ? { ...s, disc: { ...s.disc, place: 'tray' } } : s
    case 'PICK_FROM_TRAY':
      return s.disc?.place === 'tray' && s.view === 'stereo'
        ? { ...s, disc: { ...s.disc, place: 'hand' } } : s

    case 'TOGGLE_TRAY':
      if (s.trayOpen) {
        return s.disc?.place === 'tray'
          ? { ...s, trayOpen: false, disc: { ...s.disc, place: 'loaded' }, player: 'loading', track: 0 }
          : { ...s, trayOpen: false, player: 'idle', track: 0 }
      }
      return { ...s, trayOpen: true, player: 'idle', track: 0,
        disc: s.disc?.place === 'loaded' ? { ...s.disc, place: 'tray' } : s.disc }

    case 'LOADED': return s.player === 'loading' ? { ...s, player: 'stopped' } : s

    case 'PLAY':
      if (s.player === 'playing') return { ...s, player: 'paused' }
      return s.player === 'stopped' || s.player === 'paused' ? { ...s, player: 'playing' } : s
    case 'STOP':
      return s.player === 'playing' || s.player === 'paused' ? { ...s, player: 'stopped' } : s
    case 'NEXT': case 'PREV': {
      if (!hasDisc(s) || !s.disc) return s
      const n = s.disc.trackCount, d = a.type === 'NEXT' ? 1 : -1
      return { ...s, track: (s.track + d + n) % n }
    }
    case 'TRACK_ENDED':
      if (!s.disc) return s
      return s.track < s.disc.trackCount - 1
        ? { ...s, track: s.track + 1 } : { ...s, player: 'stopped', track: 0 }
  }
}
