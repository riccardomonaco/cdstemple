import { useEffect, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useSpring, a } from '@react-spring/three'
import * as THREE from 'three'
import { POSE, SPRING, OPEN_ROT_MIN, OPEN_ROT_MAX, wrapAngle } from '../config/constants'
import { useGameState, useGameDispatch } from '../state/store'
import { placeOf } from '../state/selectors'
import type { Album } from '../data/schema'

export function CDCase({ album }: { album: Album }) {
  const s = useGameState(), dispatch = useGameDispatch()
  const [isOpen, setIsOpen] = useState(false)
  const { front, back, disk, inside } = album.textures
  const [frontTex, backTex, diskTex, insideTex] = useTexture([front, back, disk, inside])
  ;[frontTex, backTex, diskTex, insideTex].forEach((t) => { t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace })

  const place = placeOf(s, album.id)
  const held = place === 'hand'
  const rotatable = s.view === 'case' && !held

  const caseRef = useRef<THREE.Group>(null)
  const pivotRef = useRef<THREE.Group>(null)
  const targetY = useRef(0)
  const dragging = useRef(false)
  const rotatableRef = useRef(rotatable); rotatableRef.current = rotatable
  const openRef = useRef(isOpen); openRef.current = isOpen

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (!dragging.current || !rotatableRef.current) return
      const next = targetY.current + ev.movementX * 0.01
      targetY.current = openRef.current ? THREE.MathUtils.clamp(next, OPEN_ROT_MIN, OPEN_ROT_MAX) : next
    }
    const up = () => { dragging.current = false }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  // Presa del disco: elimino i giri completi, la custodia torna a 0 per la via più breve
  useEffect(() => {
    if (!held) return
    if (caseRef.current) caseRef.current.rotation.y = wrapAngle(caseRef.current.rotation.y)
    targetY.current = wrapAngle(targetY.current)
  }, [held])

  // Apertura: riporto l'angolo nel range consentito
  useEffect(() => {
    if (!isOpen) return
    if (caseRef.current) caseRef.current.rotation.y = wrapAngle(caseRef.current.rotation.y)
    targetY.current = THREE.MathUtils.clamp(wrapAngle(targetY.current), OPEN_ROT_MIN, OPEN_ROT_MAX)
  }, [isOpen])

  useFrame((_, dt) => {
    const c = caseRef.current, p = pivotRef.current
    if (!c) return
    if (held) targetY.current = 0
    c.rotation.y = THREE.MathUtils.damp(c.rotation.y, targetY.current, 8, dt)
    if (p) p.rotation.y = place === 'case' ? c.rotation.y : THREE.MathUtils.damp(p.rotation.y, 0, 8, dt)
  })

  const pose =
    place === 'hand' ? (s.view === 'stereo' ? POSE.heldStereo : POSE.heldCase)
    : place === 'tray' ? POSE.tray
    : place === 'loaded' ? POSE.loaded
    : { x: 0.1, y: 0, z: isOpen ? 0.2 : 0.03, s: 1, tilt: Math.PI / 2 }
  const disc = useSpring({ ...pose, config: SPRING })
  const { lid } = useSpring({ lid: isOpen ? -Math.PI / 1.5 : 0, config: SPRING })

  const passive = place === 'tray' || place === 'loaded' // ci pensa la hitbox del vassoio

  const onDiscClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 2) return
    e.stopPropagation()
    if (place === 'case') { if (s.view === 'case' && isOpen) dispatch({ type: 'GRAB', albumId: album.id, trackCount: album.tracks.length }) }
    else if (place === 'hand') {
      if (s.view === 'case') { if (isOpen) dispatch({ type: 'RETURN' }) } else dispatch({ type: 'PUT_ON_TRAY' })
    }
  }

  return (
    <>
      <group ref={caseRef}
        onPointerDown={(e) => { e.stopPropagation(); dragging.current = true }}
        onClick={(e) => { if (e.delta > 2) return; e.stopPropagation(); setIsOpen((o) => !o) }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}>
        <mesh position={[0, 0, -0.1]}><boxGeometry args={[2.8, 2.4, 0.2]} /><meshStandardMaterial map={backTex} roughness={0.8} /></mesh>
        <mesh position={[0, 0, 0.001]}><planeGeometry args={[2.8, 2.4]} /><meshStandardMaterial map={insideTex} roughness={0.5} /></mesh>
        <a.group position={[-1.4, 0, 0]} rotation-y={lid} frustumCulled={false}>
          <mesh position={[1.4, 0, 0.1]}>
            <boxGeometry args={[2.8, 2.4, 0.1]} />
            <meshStandardMaterial map={frontTex} roughness={0.2} transparent opacity={0.9} />
          </mesh>
        </a.group>
      </group>

      <group ref={pivotRef}>
        <a.mesh frustumCulled={false} position-x={disc.x} position-y={disc.y} position-z={disc.z}
          scale={disc.s} rotation-x={disc.tilt} rotation-y={Math.PI / 3}
          raycast={passive ? () => null : undefined}
          onPointerDown={(e) => { if (place !== 'case') return; e.stopPropagation(); dragging.current = true }}
          onClick={onDiscClick}>
          <cylinderGeometry args={[1.1, 1.1, 0.02, 32]} />
          <meshStandardMaterial map={diskTex} metalness={0.7} roughness={0.5} />
        </a.mesh>
      </group>
    </>
  )
}
