import { useEffect, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useSpring, a } from '@react-spring/three'
import { STEREO_POS, SPRING } from '../config/constants'
import { useGameState, useGameDispatch } from '../state/store'
import { displayText } from '../state/selectors'
import { audio } from '../audio/player'
import type { Action } from '../state/reducer'

type Press = (e: ThreeEvent<MouseEvent>) => void

function Btn({ x, y, w = 0.3, label, color = '#3a3a42', onPress }: { x: number; y: number; w?: number; label: string; color?: string; onPress: Press }) {
  return (
    <group position={[x, y, 0.41]} onClick={onPress}>
      <mesh><boxGeometry args={[w, 0.14, 0.04]} /><meshStandardMaterial color={color} /></mesh>
      <Text position={[0, 0, 0.025]} fontSize={0.055} color="#fff" anchorX="center" anchorY="middle">{label}</Text>
    </group>
  )
}

export function Stereo() {
  const s = useGameState(), dispatch = useGameDispatch()
  const { trayZ } = useSpring({ trayZ: s.trayOpen ? 0.8 : 0, config: SPRING })

  const [sec, setSec] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSec(Math.floor(audio?.currentTime ?? 0)), 250)
    return () => clearInterval(id)
  }, [])

  // Dalla vista scrivania ogni click porta alla vista stereo; i pulsanti agiscono solo da lì.
  const act = (fn: () => void): Press => (e) => {
    if (e.delta > 2) return
    e.stopPropagation()
    if (s.view !== 'stereo') dispatch({ type: 'GO_STEREO' }); else fn()
  }
  const send = (type: Action['type']) => act(() => dispatch({ type } as Action))

  const onTray = act(() => {
    if (s.disc?.place === 'hand') dispatch({ type: 'PUT_ON_TRAY' })
    else if (s.disc?.place === 'tray') dispatch({ type: 'PICK_FROM_TRAY' })
  })

  return (
    <group position={STEREO_POS} onClick={act(() => {})}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}>
      <mesh><boxGeometry args={[1.9, 0.9, 0.8]} /><meshStandardMaterial color="#2a2a30" metalness={0.6} roughness={0.35} /></mesh>
      <mesh position={[-0.15, 0.25, 0.401]}><planeGeometry args={[1.1, 0.3]} /><meshBasicMaterial color="#050507" /></mesh>
      <Text position={[-0.15, 0.25, 0.41]} fontSize={0.11} color="#3cff9a" anchorX="center" anchorY="middle" letterSpacing={0.08}>
        {displayText(s, sec)}
      </Text>
      <Btn x={0.7} y={0.25} label="EJECT" color={s.trayOpen ? '#3cff9a' : '#b33'} onPress={send('TOGGLE_TRAY')} />
      <Btn x={-0.6} y={-0.2} label="<<" onPress={send('PREV')} />
      <Btn x={-0.25} y={-0.2} label={s.player === 'playing' ? 'PAUSE' : 'PLAY'} onPress={send('PLAY')} />
      <Btn x={0.1} y={-0.2} label="STOP" onPress={send('STOP')} />
      <Btn x={0.45} y={-0.2} label=">>" onPress={send('NEXT')} />

      <a.group position-z={trayZ}>
        {s.trayOpen && (
          // hitbox invisibile: il vassoio è troppo sottile per essere cliccato
          <mesh position={[0, 0.15, 0]} onClick={onTray}>
            <boxGeometry args={[1.1, 0.4, 0.6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[1.1, 0.04, 0.6]} /><meshStandardMaterial color="#111" roughness={0.8} /></mesh>
        <mesh position={[0, 0.041, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.3, 32]} /><meshStandardMaterial color="#050505" /></mesh>
      </a.group>
    </group>
  )
}
