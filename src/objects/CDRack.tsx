import { CDCase } from './CDCase'
import { RACK, slotPose } from '../config/rack'
import type { Album } from '../data/schema'

const WOOD = '#5c4033'

export function CDRack({ albums }: { albums: Album[] }) {
  const { pos, scale, capacity, pitch, width: W, depth: D } = RACK
  const H = 0.2 + pitch * capacity

  return (
    <>
      {/* Mobile: origine locale = centro della base, sulla scrivania */}
      <group position={pos} scale={scale}>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[W, 0.1, D]} /><meshStandardMaterial color={WOOD} roughness={0.9} /></mesh>
        <mesh position={[0, H - 0.05, 0]}><boxGeometry args={[W, 0.1, D]} /><meshStandardMaterial color={WOOD} roughness={0.9} /></mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (W / 2 - 0.05), H / 2, 0]}>
            <boxGeometry args={[0.1, H, D]} /><meshStandardMaterial color={WOOD} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, H / 2, -D / 2 + 0.05]}>
          <boxGeometry args={[W - 0.2, H - 0.2, 0.1]} /><meshStandardMaterial color="#111" roughness={0.7} />
        </mesh>
        {Array.from({ length: capacity - 1 }).map((_, i) => (
          <mesh key={i} position={[0, 0.1 + pitch * (i + 1), 0]}>
            <boxGeometry args={[W - 0.2, 0.02, D - 0.1]} /><meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Custodie: posa assoluta, calcolata da slotPose */}
      {albums.slice(0, capacity).map((album, i) => (
        <CDCase key={album.id} album={album} slot={slotPose(i)} />
      ))}
    </>
  )
}