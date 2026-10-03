import { DESK_TOP_Y } from '../config/constants'
export function Desk() {
  return (
    <mesh position={[-0.7, DESK_TOP_Y - 0.1, 0.5]}>
      <boxGeometry args={[8.6, 0.2, 3]} />
      <meshStandardMaterial color="#5a3d2b" roughness={0.7} />
    </mesh>
  )
}
