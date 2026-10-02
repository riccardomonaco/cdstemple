import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useSpring, a } from '@react-spring/three'

// Componente Custodia CD
function JewelCase() {
  const [isOpen, setIsOpen] = useState(false)
  
  // Animazione basata sulla fisica (inerzia e peso)
  const { lidRotation, cdElevation } = useSpring({
    lidRotation: isOpen ? -Math.PI / 1.5 : 0, // Ruota di circa 120 gradi indietro
    cdElevation: isOpen ? 0.2 : 0, // Solleva leggermente il CD quando si apre
    config: { mass: 2, tension: 120, friction: 40 } // I parametri che danno il senso di "peso"
  })

  return (
    <group 
      onClick={(e) => {
        e.stopPropagation(); // Evita conflitti di click
        setIsOpen(!isOpen);
      }}
      // Quando il mouse passa sopra, cambiamo il cursore per far capire che è interattivo
      onPointerOver={() => document.body.style.cursor = 'pointer'}
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      {/* Base della custodia in plastica */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[2.8, 0.2, 2.4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>

      {/* Il CD (cilindro sottilissimo) */}
      <a.mesh position-y={cdElevation} position-x={0} position-z={0}>
        <cylinderGeometry args={[1.1, 1.1, 0.02, 32]} />
        <meshStandardMaterial color="#d4d4d4" metalness={0.8} roughness={0.2} />
      </a.mesh>

      {/* Coperchio trasparente animato */}
      {/* Usiamo a.group di react-spring e posizioniamo il perno di rotazione sul retro */}
      <a.group position={[0, 0, -1.2]} rotation-x={lidRotation}>
        <mesh position={[0, 0.1, 1.2]}>
          <boxGeometry args={[2.8, 0.15, 2.4]} />
          <meshStandardMaterial color="lightblue" transparent opacity={0.3} roughness={0.1} />
        </mesh>
      </a.group>
    </group>
  )
}

export default function App() {
  return (
    // Uno sfondo scuro in stile liminale
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0f0f13' }}>
      <Canvas camera={{ position: [0, 3, 5], fov: 45 }}>
        {/* Luci per dare un po' di volume y2k */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <JewelCase />
        
        {/* Un'ombra morbida sotto il CD per ancorarlo allo spazio */}
        <ContactShadows position={[0, -0.5, 0]} opacity={0.5} scale={10} blur={2} far={4} />

        {/* Controlli per ruotare la visuale con il mouse (tasto sx ruota, dx sposta) */}
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 1.5} 
          minDistance={3}
          maxDistance={8}
        />
      </Canvas>
    </div>
  )
}