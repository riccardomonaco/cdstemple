import * as THREE from 'three'
export const DESK_TOP_Y = -1.3
export const STEREO_POS: [number, number, number] = [2.4, -0.85, 1.2]
export const CAM_Z_DEFAULT = 7.2, CAM_Z_GRAB_OFFSET = 0.6, ZOOM_MIN = 0, ZOOM_MAX = 3
export const CAM_TARGET_DEFAULT = new THREE.Vector3(0, 0, 0)
export const CAM_STEREO = { pos: new THREE.Vector3(2.4, 0.1, 3.3), target: new THREE.Vector3(2.4, -0.8, 1.4) }
// tilt: PI/2 = in piedi, 0 = steso
export const POSE = {
  heldCase:   { x: 0.1, y: 0,    z: 3.1, s: 0.8, tilt: Math.PI / 2 },
  heldStereo: { x: 1.6, y: -0.5, z: 2.2, s: 0.2, tilt: Math.PI / 2 },
  tray:       { x: 2.4, y: -0.79, z: 2.0, s: 0.2, tilt: 0 },
  loaded:     { x: 2.4, y: -0.79, z: 1.2, s: 0.2, tilt: 0 },
}
export const OPEN_ROT_MIN = -Math.PI, OPEN_ROT_MAX = 1.4
export const SPRING = { mass: 1, tension: 170, friction: 26 }
export const wrapAngle = (v: number) => THREE.MathUtils.euclideanModulo(v + Math.PI, Math.PI * 2) - Math.PI
