import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAM_Z_DEFAULT, CAM_Z_GRAB_OFFSET, CAM_TARGET_DEFAULT, CAM_STEREO, ZOOM_MIN, ZOOM_MAX } from '../config/constants'
import type { View } from '../state/reducer'

export function CameraRig({ view, held }: { view: View; held: boolean }) {
  const look = useRef(CAM_TARGET_DEFAULT.clone())
  const zoom = useRef(0)
  const goal = useRef(new THREE.Vector3())

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (view !== 'case' || held) return
      zoom.current = THREE.MathUtils.clamp(zoom.current - e.deltaY * 0.002, ZOOM_MIN, ZOOM_MAX)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [view, held])

  useEffect(() => { if (held) zoom.current = 0 }, [held])

  useFrame((state) => {
    let target = CAM_TARGET_DEFAULT
    if (view === 'stereo') { goal.current.copy(CAM_STEREO.pos); target = CAM_STEREO.target }
    else goal.current.set(0, 0, CAM_Z_DEFAULT - zoom.current + (held ? CAM_Z_GRAB_OFFSET : 0))
    state.camera.position.lerp(goal.current, 0.08)
    look.current.lerp(target, 0.08)
    state.camera.lookAt(look.current)
  })
  return null
}
