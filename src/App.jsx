import { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows, useTexture } from '@react-three/drei'
import { useSpring, a } from '@react-spring/three'
import * as THREE from 'three'

// --- DEBUG HUD ---
// Stampa i valori in tempo reale nel div HTML esterno senza triggerare re-render di React
function DebugHUD({ controlsRef }) {
  useFrame((state) => {
    const debugPanel = document.getElementById('debug-panel')
    if (debugPanel) {
      const cam = state.camera.position
      const tar = controlsRef.current ? controlsRef.current.target : { x: 0, y: 0, z: 0 }
      
      debugPanel.innerText = 
        `--- DEBUG R3F ---\n` +
        `CAMERA : [ ${cam.x.toFixed(2)},  ${cam.y.toFixed(2)},  ${cam.z.toFixed(2)} ]\n` +
        `TARGET : [ ${tar.x.toFixed(2)},  ${tar.y.toFixed(2)},  ${tar.z.toFixed(2)} ]`
    }
  })
  return null
}

// --- GESTORE DELLA TELECAMERA ---
function CameraReset({ isGrabbed, controlsRef }) {
  useFrame((state) => {
    if (isGrabbed && controlsRef.current) {
      // Questi sono i valori verso cui la camera sta cercando di andare.
      // Potrai modificarli una volta trovati quelli perfetti dal pannello di debug.
      state.camera.position.lerp(new THREE.Vector3(0, 0, 8.5), 0.1);
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.1);
      controlsRef.current.update();
    }
  });
  return null;
}

function CDCase({ isGrabbed, onGrabToggle }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const [frontTex, backTex, diskTex, insideTex] = useTexture([
    '/covers/howhigh/front.jpg', 
    '/covers/howhigh/back.jpg', 
    '/covers/howhigh/disk.jpg',
    '/covers/howhigh/inside.jpg'
  ])

  frontTex.magFilter = THREE.NearestFilter
  backTex.magFilter = THREE.NearestFilter
  diskTex.magFilter = THREE.NearestFilter
  insideTex.magFilter = THREE.NearestFilter
  frontTex.colorSpace = THREE.SRGBColorSpace
  backTex.colorSpace = THREE.SRGBColorSpace
  diskTex.colorSpace = THREE.SRGBColorSpace
  insideTex.colorSpace = THREE.SRGBColorSpace

  const { lidRotation, cdZ, cdY, cdX } = useSpring({
    lidRotation: isOpen ? -Math.PI / 1.5 : 0, 
    cdZ: isGrabbed ? 3.1 : (isOpen ? 0.2 : 0), 
    cdY: isGrabbed ? 0.5 : 0, 
    cdX: isGrabbed ? 0 : 0, 
    config: { mass: 1, tension: 150, friction: 30 } 
  })

  return (
    <group 
      onClick={(e) => {
        if (e.delta > 2) return;
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      onPointerOver={() => document.body.style.cursor = 'pointer'}
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[2.8, 2.4, 0.2]} />
        <meshStandardMaterial map={backTex} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[2.7, 2.3]} />
        <meshStandardMaterial map={insideTex} roughness={0.5} />
      </mesh>

      <a.mesh 
        frustumCulled={false}
        position-z={cdZ} 
        position-y={cdY} 
        position-x={cdX} 
        rotation-x={Math.PI / 2}
        onClick={(e) => {
          if (e.delta > 2) return;
          e.stopPropagation(); 
          if (isOpen) onGrabToggle();
        }}
      >
        <cylinderGeometry args={[1.1, 1.1, 0.02, 32]} />
        <meshStandardMaterial map={diskTex} metalness={0.5} roughness={0.5} />
      </a.mesh>

      <a.group position={[-1.4, 0, 0]} rotation-y={lidRotation} frustumCulled={false}>
        <mesh position={[1.4, 0, 0.1]}>
          <boxGeometry args={[2.8, 2.4, 0.1]} />
          <meshStandardMaterial map={frontTex} roughness={0.2} transparent opacity={0.9} />
        </mesh>
      </a.group>
    </group>
  )
}

export default function App() {
  const [isCdGrabbed, setIsCdGrabbed] = useState(false)
  const controlsRef = useRef()

  return (
    <>
      {/* UI HTML in overlay */}
      <div 
        id="debug-panel" 
        style={{ 
          position: 'absolute', 
          top: 10, 
          right: 10, 
          color: '#0f0', 
          backgroundColor: '#000c', 
          padding: '15px', 
          fontFamily: 'monospace', 
          zIndex: 100, 
          whiteSpace: 'pre-wrap',
          border: '1px solid #0f0'
        }}
      >
        Caricamento telemetria...
      </div>

      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0f0f13' }}>
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
          
          <DebugHUD controlsRef={controlsRef} />
          <CameraReset isGrabbed={isCdGrabbed} controlsRef={controlsRef} />

          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          <CDCase 
            isGrabbed={isCdGrabbed}
            onGrabToggle={() => setIsCdGrabbed(!isCdGrabbed)}
          />
          
          <ContactShadows position={[0, -1.3, 0]} opacity={0.5} scale={10} blur={2} far={4} />

          <OrbitControls 
            ref={controlsRef}
            enablePan={false} 
            enabled={!isCdGrabbed} 
            minPolarAngle={Math.PI / 2 - 0.3} 
            maxPolarAngle={Math.PI / 2 + 0.3} 
            minDistance={3}
            maxDistance={10}
          />
        </Canvas>
      </div>
    </>
  )
}