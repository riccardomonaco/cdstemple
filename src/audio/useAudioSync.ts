import { useEffect } from 'react'
import { audio } from './player'
import { useGameState, useGameDispatch } from '../state/store'
import type { Album } from '../data/schema'

// L'audio SEGUE lo stato, mai il contrario.
export function useAudioSync(albums: Map<string, Album>) {
  const s = useGameState(), dispatch = useGameDispatch()
  const loaded = s.player === 'stopped' || s.player === 'playing' || s.player === 'paused'
  const src = loaded && s.disc ? albums.get(s.disc.albumId)?.tracks[s.track]?.src ?? null : null

  useEffect(() => {
    const el = audio
    if (!el) return
    const onEnd = () => dispatch({ type: 'TRACK_ENDED' })
    el.addEventListener('ended', onEnd)
    return () => el.removeEventListener('ended', onEnd)
  }, [dispatch])

  useEffect(() => {
    if (!audio) return
    if (src) audio.src = src
    else { audio.pause(); audio.removeAttribute('src'); audio.load() }
  }, [src])

  useEffect(() => {
    if (!audio || !src) return
    if (s.player === 'playing') audio.play().catch(() => dispatch({ type: 'PLAY' }))
    else { audio.pause(); if (s.player === 'stopped') audio.currentTime = 0 }
  }, [s.player, src, dispatch])
}
