import type { State, DiscPlace } from './reducer'
export const placeOf = (s: State, albumId: string): DiscPlace | 'case' =>
  s.disc && s.disc.albumId === albumId ? s.disc.place : 'case'
export const isHeld = (s: State) => s.disc?.place === 'hand'

const pad = (n: number) => String(n).padStart(2, '0')
const mmss = (t: number) => `${Math.floor(t / 60)}:${pad(t % 60)}`

export function displayText(s: State, sec: number): string {
  if (s.trayOpen) return 'OPEN'
  switch (s.player) {
    case 'idle': return 'NO DISC'
    case 'loading': return 'LOADING'
    case 'stopped': return `${s.disc?.trackCount ?? 0} TRACKS`
    case 'playing': return `TRACK ${pad(s.track + 1)}  ${mmss(sec)}`
    case 'paused': return `PAUSE ${pad(s.track + 1)}`
  }
}
