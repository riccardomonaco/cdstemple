import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { CAM_Z_DEFAULT, DESK_TOP_Y } from '../config/constants'
import { useGameState } from '../state/store'
import { isHeld } from '../state/selectors'
import { CameraRig } from './CameraRig'
import { Desk } from './Desk'
import { CDCase } from '../objects/CDCase'
import { Stereo } from '../objects/Stereo'
import type { Album } from '../data/schema'

function DebugHUD() {
  useFrame((st) => {
    const el = document.getElementById('debug-panel'); if (!el) return
    const c = st.camera.position
    el.innerText = `--- DEBUG R3F ---\nCAMERA : [ ${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)} ]`
  })
  return null
}

export function Scene({ albums }: { albums: Album[] }) {
  const s = useGameState()
  return (
    <Canvas camera={{ position: [0, 0, CAM_Z_DEFAULT], fov: 45 }}>
      <DebugHUD />
      <CameraRig view={s.view} held={isHeld(s)} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <Desk />
      {albums.map((al) => <CDCase key={al.id} album={al} />)}
      <Stereo />
      <ContactShadows position={[0, DESK_TOP_Y + 0.01, 0]} opacity={0.5} scale={10} blur={2} far={4} />
    </Canvas>
  )
}
