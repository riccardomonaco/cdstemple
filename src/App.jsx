import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, useTexture } from '@react-three/drei'
import { useSpring, a } from '@react-spring/three'
import * as THREE from 'three'

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

  // --- AREA DI TESTING PER IL GRAB ---
  // Tweakka questi valori (quelli dopo il '?' nella condizione isGrabbed)
  const { lidRotation, cdZ, cdY, cdX } = useSpring({
    lidRotation: isOpen ? -Math.PI / 1.5 : 0, 
    
    // cdZ: Muove il CD verso di te (avanti/indietro). 
    // Valori più alti = più vicino alla telecamera.
    // Prova ad alzare questo valore (es. 2.5 o 3.0) per far passare il coperchio "dietro" al disco.
    cdZ: isGrabbed ? 2.5 : (isOpen ? 0.2 : 0), 
    
    // cdY: Muove il CD in alto/basso.
    // 0 = centrato nella scatola. Numeri positivi lo alzano.
    cdY: isGrabbed ? 0.5 : 0,
    
    // cdX: Muove il CD a destra/sinistra.
    // 0 = perfettamente centrato. Numeri positivi lo spostano a destra, negativi a sinistra.
    cdX: isGrabbed ? 0 : 0,
    
    config: { mass: 1, tension: 150, friction: 30 } 
  })
  // ------------------------------------

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

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0f0f13' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <CDCase 
          isGrabbed={isCdGrabbed}
          onGrabToggle={() => setIsCdGrabbed(!isCdGrabbed)}
        />
        
        <ContactShadows position={[0, -1.3, 0]} opacity={0.5} scale={10} blur={2} far={4} />

        {/* OrbitControls pulito, senza blocchi forzati esterni che spaccano lo zoom */}
        <OrbitControls 
          enablePan={false} 
          enabled={!isCdGrabbed} // Blocca la rotazione quando il CD è in mano
          minPolarAngle={Math.PI / 2 - 0.1} 
          maxPolarAngle={Math.PI / 2 + 0.1} 
          minDistance={3}
          maxDistance={8}
        />
      </Canvas>
    </div>
  )
}