import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Reusable Cinematic 3D Background that reacts to mouse pointer.
 * Simplified to a clean Night Starry Sky effect.
 * @param {string} type - 'neural', 'documents', 'scales', 'default'
 */
function CinematicScene({ color1 }) {
  const groupRef = useRef();

  useFrame((state) => {
    // Parallax mouse follow
    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, (state.pointer.y * Math.PI) / 30, 0.05);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, (state.pointer.x * Math.PI) / 30, 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <pointLight position={[-5, -5, -5]} color={color1} intensity={1} />
      
      {/* Background Deep Stars */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* Midground Stars */}
      <Stars radius={50} depth={20} count={2000} factor={3} saturation={0} fade speed={1.5} />
    </group>
  );
}

export default function CinematicSectionBackground({ type = 'default', color1 = '#3b82f6', color2 = '#8b5cf6' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <CinematicScene color1={color1} />
      </Canvas>
    </div>
  );
}
