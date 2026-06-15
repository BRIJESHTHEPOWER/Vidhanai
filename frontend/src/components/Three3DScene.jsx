import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  MeshReflectorMaterial, 
  Sparkles, 
  Html, 
  PerspectiveCamera,
  OrbitControls,
  Environment,
  Float,
  useGLTF,
  Sphere,
  Box,
  Torus,
  TorusKnot,
  Icosahedron,
} from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

// ─── Enhanced Floating Geo ────────────────────────────────────
function FloatingGeo({ position, color, scale, speed, geometry: GeoComponent }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += speed * 0.005;
      meshRef.current.rotation.y += speed * 0.008;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed) * 0.003;
    }
  });

  return (
    <group position={position}>
      <GeoComponent ref={meshRef} scale={scale} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.8}
          transmission={0.1}
        />
      </GeoComponent>
    </group>
  );
}

// ─── Courthouse Building Enhanced ────────────────────────────
function CourthouseBuilding() {
  return (
    <group position={[0, -2, -20]} scale={1.2}>
      {/* Main facade */}
      <mesh position={[0, 6, 0]} receiveShadow castShadow>
        <boxGeometry args={[28, 14, 3]} />
        <meshStandardMaterial
          color="#1a3a2a"
          roughness={0.7}
          metalness={0.2}
          emissive="#00c853"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Glowing pediment */}
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[0, 14, 4, 3, 1]} />
        <meshStandardMaterial
          color="#0e1a15"
          emissive="#00c853"
          emissiveIntensity={0.15}
          roughness={0.8}
        />
      </mesh>

      {/* Frieze strip */}
      <mesh position={[0, 13.2, 0.4]}>
        <boxGeometry args={[28.5, 0.8, 0.4]} />
        <meshStandardMaterial
          color="#1a2e24"
          emissive="#00c853"
          emissiveIntensity={0.2}
          roughness={0.6}
        />
      </mesh>

      {/* Columns */}
      {[-10, -6, -2, 2, 6, 10].map((x, i) => (
        <group key={i} position={[x, 5, 1.8]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.65, 12, 12]} />
            <meshStandardMaterial
              color="#1a2a20"
              emissive="#00c853"
              emissiveIntensity={0.1}
              roughness={0.75}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 6.4, 0]}>
            <boxGeometry args={[1.4, 0.6, 1.4]} />
            <meshStandardMaterial
              color="#162214"
              emissive="#00c853"
              emissiveIntensity={0.12}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[0, -6.4, 0]}>
            <boxGeometry args={[1.4, 0.6, 1.4]} />
            <meshStandardMaterial
              color="#162214"
              emissive="#00c853"
              emissiveIntensity={0.12}
              roughness={0.8}
            />
          </mesh>
        </group>
      ))}

      {/* Steps */}
      {[0, 1, 2, 3].map((s) => (
        <mesh key={s} position={[0, s * -0.42 - 0.9, 2.5 + s * 1.2]} receiveShadow castShadow>
          <boxGeometry args={[26 - s, 0.4, 1.5]} />
          <meshStandardMaterial
            color="#111d17"
            emissive="#009937"
            emissiveIntensity={0.08}
            roughness={0.6}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Glowing indicators */}
      <pointLight position={[0, 15, 2]} intensity={1.5} color="#00c853" distance={30} />
      <pointLight position={[-15, 6, 5]} intensity={0.8} color="#69f0ae" distance={20} />
      <pointLight position={[15, 6, 5]} intensity={0.8} color="#69f0ae" distance={20} />
    </group>
  );
}

// ─── Reflective Ground ────────────────────────────────────
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={[500, 500]}
        resolution={1024}
        scale={1}
        color="#0a4a1a"
        metalness={0.8}
        roughness={0.1}
      />
    </mesh>
  );
}

// ─── Scene Canvas ────────────────────────────────────────────
export default function Three3DScene() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [0, 8, 35], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#0a0f0a']} />

        {/* Lighting */}
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight
          position={[25, 20, 8]}
          intensity={1.2}
          color="#69f0ae"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <pointLight position={[0, 20, 10]} intensity={0.6} color="#00c853" />
        <pointLight position={[-20, 10, 20]} intensity={0.4} color="#69f0ae" />

        {/* Environment */}
        <Environment preset="night" intensity={0.8} />

        {/* Main content */}
        <Ground />
        <CourthouseBuilding />

        {/* Floating geometric elements */}
        <FloatingGeo position={[-8, 5, -5]} color="#00c853" scale={0.8} speed={1} geometry={Sphere} />
        <FloatingGeo position={[8, 8, -5]} color="#69f0ae" scale={0.6} speed={1.5} geometry={Box} />
        <FloatingGeo position={[0, 12, -8]} color="#00c853" scale={0.7} speed={0.8} geometry={Torus} />
        <FloatingGeo position={[-12, 6, -3]} color="#69f0ae" scale={0.5} speed={1.2} geometry={TorusKnot} />
        <FloatingGeo position={[12, 10, -6]} color="#00c853" scale={0.6} speed={1.3} geometry={Icosahedron} />

        {/* Sparkles */}
        <Sparkles
          count={100}
          scale={[40, 40, 40]}
          size={0.5}
          speed={0.5}
          color="#00c853"
          opacity={0.6}
        />

        {/* Camera controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          autoRotate={true}
          autoRotateSpeed={2}
          maxDistance={80}
          minDistance={20}
        />
      </Canvas>
    </div>
  );
}
