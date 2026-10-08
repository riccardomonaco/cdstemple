import React from "react";
import { CDCase } from "./CDCase";
import type { Album } from "../data/schema";

interface CDRackProps {
  albums: Album[];
  position?: [number, number, number];
  capacity?: number;
}

export function CDRack({ 
  albums, 
  position = [-3.8, -0.6, 0.5], // Posizionato a sinistra sulla scrivania
  capacity = 12 
}: CDRackProps) {
  const [startX, startY, startZ] = position;

  // Dimensioni calcolate in base al GLB del tuo CD
  const cdSpacing = 0.32; // Spazio verticale tra uno slot e l'altro
  const rackWidth = 3.1;
  const rackDepth = 2.5;
  const rackHeight = capacity * cdSpacing + 0.4; // 0.2 di padding sopra e sotto

  return (
    <>
      {/* 1. STRUTTURA FISICA DEL MOBILE (Legno e Plastica scura) */}
      <group position={[startX, startY + rackHeight / 2 - 0.2, startZ]}>
        
        {/* Pannello Sinistro (Legno) */}
        <mesh position={[-rackWidth / 2 + 0.05, 0, 0]}>
          <boxGeometry args={[0.1, rackHeight, rackDepth]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        
        {/* Pannello Destro (Legno) */}
        <mesh position={[rackWidth / 2 - 0.05, 0, 0]}>
          <boxGeometry args={[0.1, rackHeight, rackDepth]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        
        {/* Pannello Superiore (Legno) */}
        <mesh position={[0, rackHeight / 2 - 0.05, 0]}>
          <boxGeometry args={[rackWidth, 0.1, rackDepth]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        
        {/* Pannello Inferiore / Base (Legno) */}
        <mesh position={[0, -rackHeight / 2 + 0.05, 0]}>
          <boxGeometry args={[rackWidth, 0.1, rackDepth]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>

        {/* Schienale (Plastica scura) */}
        <mesh position={[0, 0, -rackDepth / 2 + 0.05]}>
          <boxGeometry args={[rackWidth - 0.2, rackHeight - 0.2, 0.1]} />
          <meshStandardMaterial color="#111111" roughness={0.7} />
        </mesh>

        {/* Ripiani / Slot divisori (Plastica scura) */}
        {Array.from({ length: capacity - 1 }).map((_, i) => (
          <mesh key={`shelf-${i}`} position={[0, -rackHeight / 2 + 0.2 + (i + 1) * cdSpacing, 0]}>
            <boxGeometry args={[rackWidth - 0.2, 0.02, rackDepth - 0.1]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* 2. CD RENDERIZZATI ALL'INTERNO DEGLI SLOT */}
      {albums.map((album, index) => {
        // Calcoliamo la posizione *assoluta* per non sfalsare le molle di useSpring
        const homePose = {
          x: startX,
          y: startY + index * cdSpacing + 0.16, // +0.16 centra il CD nello slot\
          z: startZ + 0.05, // Sporge leggermente in avanti
          tilt: Math.PI / 2,
        };

        return <CDCase key={album.id} album={album} homePose={homePose} />;
      })}
    </>
  );
}