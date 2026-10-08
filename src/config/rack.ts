import { DESK_TOP_Y } from './constants'

export const RACK = {
  pos: [-3.7, DESK_TOP_Y, 0.3] as [number, number, number], // base del mobile sulla scrivania
  scale: 0.8,
  capacity: 12,
  pitch: 0.32,   // distanza tra due slot
  width: 3.1,
  depth: 3.0,    // la custodia è larga ~2.84
  hover: 0.45,   // quanto esce all'hover (unità del rack)
}

// Posa "a riposo" di una custodia nello slot i (coordinate mondo)
export function slotPose(i: number) {
  const { pos, scale, pitch, hover } = RACK
  return {
    position: [pos[0], pos[1] + scale * (0.1 + pitch * (i + 0.5)), pos[2] + scale * 0.05] as [number, number, number],
    scale,
    hover: hover * scale,
  }
}
export type RackSlot = ReturnType<typeof slotPose>