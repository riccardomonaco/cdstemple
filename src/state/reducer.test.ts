import { describe, it, expect } from 'vitest'
import { reducer, initialState, type Action } from './reducer'

const run = (actions: Action[]) => actions.reduce(reducer, initialState)
const grabbed: Action[] = [{ type: 'GRAB', albumId: 'a', trackCount: 3 }]
const atStereo: Action[] = [...grabbed, { type: 'GO_STEREO' }]
const insert: Action[] = [{ type: 'TOGGLE_TRAY' }, { type: 'PUT_ON_TRAY' }, { type: 'TOGGLE_TRAY' }]
const loaded: Action[] = [...atStereo, ...insert, { type: 'LOADED' }]

describe('flusso disco', () => {
  it('grab -> vassoio -> loading -> stopped', () => {
    const s = run(loaded)
    expect(s.disc?.place).toBe('loaded'); expect(s.player).toBe('stopped'); expect(s.trayOpen).toBe(false)
  })
  it('non si posa sul vassoio chiuso o fuori dalla vista stereo', () => {
    expect(run([...atStereo, { type: 'PUT_ON_TRAY' }]).disc?.place).toBe('hand')
    expect(run([...grabbed, { type: 'TOGGLE_TRAY' }, { type: 'PUT_ON_TRAY' }]).disc?.place).toBe('hand')
  })
  it('un solo disco fuori alla volta', () => {
    expect(run([...grabbed, { type: 'GRAB', albumId: 'b', trackCount: 1 }]).disc?.albumId).toBe('a')
  })
  it('RETURN solo dalla vista custodia', () => {
    expect(run([...atStereo, { type: 'RETURN' }]).disc).not.toBeNull()
    expect(run([...grabbed, { type: 'RETURN' }]).disc).toBeNull()
  })
  it('eject con disco caricato ferma tutto e lo porta sul vassoio', () => {
    const s = run([...loaded, { type: 'PLAY' }, { type: 'TOGGLE_TRAY' }])
    expect(s.player).toBe('idle'); expect(s.disc?.place).toBe('tray'); expect(s.trayOpen).toBe(true)
  })
  it('vassoio chiuso senza disco: niente loading', () => {
    expect(run([{ type: 'TOGGLE_TRAY' }, { type: 'TOGGLE_TRAY' }]).player).toBe('idle')
  })
})

describe('trasporto', () => {
  it('play / pause / stop', () => {
    expect(run([...loaded, { type: 'PLAY' }]).player).toBe('playing')
    expect(run([...loaded, { type: 'PLAY' }, { type: 'PLAY' }]).player).toBe('paused')
    expect(run([...loaded, { type: 'PLAY' }, { type: 'STOP' }]).player).toBe('stopped')
  })
  it('play ignorato senza disco o durante il loading', () => {
    expect(run([{ type: 'PLAY' }]).player).toBe('idle')
    expect(run([...atStereo, ...insert, { type: 'PLAY' }]).player).toBe('loading')
  })
  it('next/prev girano sulle tracce', () => {
    expect(run([...loaded, { type: 'PREV' }]).track).toBe(2)
    expect(run([...loaded, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }]).track).toBe(0)
  })
  it('fine ultima traccia -> stopped, traccia 0', () => {
    const s = run([...loaded, { type: 'PLAY' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'TRACK_ENDED' }])
    expect(s.player).toBe('stopped'); expect(s.track).toBe(0)
  })
})
