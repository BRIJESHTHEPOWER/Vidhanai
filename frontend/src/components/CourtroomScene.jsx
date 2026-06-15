import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Sky } from '@react-three/drei';
import * as THREE from 'three';

/* ─── Dynamic Outdoor Lighting & Sky ─── */
function DynamicEnvironment({ scene }) {
  const sun = useRef();
  const ambient = useRef();
  const skyProps = useRef({
    sunPosition: new THREE.Vector3(10, 4, -20),
    rayleigh: 2,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8
  });

  useFrame(({ clock }, dt) => {
    // Transition from sunset (Scene < 3) to magical twilight/night (Scene >= 3)
    if (scene >= 3) {
      skyProps.current.sunPosition.lerp(new THREE.Vector3(0, -10, -20), dt * 0.5); // Sun goes down
      if (ambient.current) ambient.current.color.lerp(new THREE.Color('#1e3a8a'), dt * 0.5); // Deep blue
      if (sun.current) sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, 0.2, dt * 0.5);
    } else {
      skyProps.current.sunPosition.lerp(new THREE.Vector3(10, 4, -20), dt * 0.5); // Sunset
      if (ambient.current) ambient.current.color.lerp(new THREE.Color('#fff7ed'), dt * 0.5); // Warm
      if (sun.current) sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, 2.5, dt * 0.5);
    }
  });

  return (
    <group>
      <Sky 
        distance={45000} 
        sunPosition={skyProps.current.sunPosition} 
        rayleigh={skyProps.current.rayleigh}
        mieCoefficient={skyProps.current.mieCoefficient}
        mieDirectionalG={skyProps.current.mieDirectionalG}
      />
      <ambientLight ref={ambient} intensity={0.8} color="#fff7ed" />
      <directionalLight 
        ref={sun} 
        position={[10, 20, 10]} 
        intensity={2.5} 
        color="#fbbf24" 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-camera-far={80} 
      />
      <directionalLight position={[-10, 10, -5]} intensity={1.0} color="#3b82f6" />
    </group>
  );
}

/* ─── Polished Marble Courtyard ─── */
function CourtyardFloor({ scene }) {
  const floorMat = useRef();
  
  useFrame(({ clock }) => {
    if (!floorMat.current) return;
    if (scene >= 5) {
      floorMat.current.emissiveIntensity = 0.05 + Math.sin(clock.elapsedTime * 2) * 0.05;
      floorMat.current.emissive.setHex(0x1e3a8a);
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]} receiveShadow>
      <planeGeometry args={[150, 150]} />
      <meshStandardMaterial 
        ref={floorMat} 
        color="#1a1a1a" 
        metalness={0.85} 
        roughness={0.15} 
      />
      <gridHelper args={[150, 50, '#3b82f6', '#0f172a']} position={[0, 0.01, 0]} />
    </mesh>
  );
}

/* ─── Background Supreme Court Dome ─── */
function SupremeCourtDome() {
  return (
    <group position={[0, 5, -45]}>
      {/* Main Building Base */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[40, 10, 10]} />
        <meshStandardMaterial color="#c8bca7" roughness={0.9} />
      </mesh>
      {/* Pillar colonnade approximation */}
      {[-16, -12, -8, -4, 0, 4, 8, 12, 16].map((x) => (
        <mesh key={x} position={[x, 5, 5.5]} castShadow>
          <cylinderGeometry args={[0.6, 0.8, 10, 12]} />
          <meshStandardMaterial color="#d1c5af" roughness={0.8} />
        </mesh>
      ))}
      {/* Top Pediment */}
      <mesh position={[0, 6, 0]} castShadow>
        <boxGeometry args={[42, 2, 12]} />
        <meshStandardMaterial color="#c8bca7" roughness={0.9} />
      </mesh>
      {/* Central Dome Base */}
      <mesh position={[0, 9, -2]} castShadow>
        <cylinderGeometry args={[8, 8, 4, 32]} />
        <meshStandardMaterial color="#d1c5af" roughness={0.8} />
      </mesh>
      {/* Central Dome */}
      <mesh position={[0, 11, -2]} castShadow>
        <sphereGeometry args={[8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e5e5e5" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* Flagpole */}
      <mesh position={[0, 19, -2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 4]} />
        <meshStandardMaterial color="#ffffff" metalness={0.8} />
      </mesh>
    </group>
  );
}

/* ─── Intricate Iron Gates ─── */
function IronGates({ scene }) {
  const L = useRef(), R = useRef(), burst = useRef(), burstLight = useRef(), symbols = useRef();
  
  useFrame((_, dt) => {
    if (!L.current) return;
    
    // Scene 5-8: Golden energy activates on gate
    if (scene >= 5 && scene < 8) {
      if (symbols.current) symbols.current.material.opacity = THREE.MathUtils.lerp(symbols.current.material.opacity, 0.8, dt * 1.5);
    }
    
    // Scene 8+: Gate Opens with massive burst
    if (scene >= 8) {
      L.current.rotation.y = THREE.MathUtils.lerp(L.current.rotation.y, 0.6, dt * 0.8);
      R.current.rotation.y = THREE.MathUtils.lerp(R.current.rotation.y, -0.6, dt * 0.8);
      
      if (burstLight.current) {
        burstLight.current.intensity = THREE.MathUtils.lerp(burstLight.current.intensity, 20, dt * 2.0);
      }
      if (burst.current) {
        burst.current.material.opacity = THREE.MathUtils.lerp(burst.current.material.opacity, 1.0, dt * 1.5);
        burst.current.scale.lerp(new THREE.Vector3(1.5, 1.5, 1.5), dt * 0.5);
      }
    }
  });

  const gateMat = <meshStandardMaterial color="#050505" metalness={0.9} roughness={0.3} />;
  const goldMat = <meshStandardMaterial color="#fbbf24" metalness={1.0} roughness={0.2} />;

  // Helper to build a gate door
  const GateDoor = ({ side }) => {
    const isLeft = side === 'L';
    const xDir = isLeft ? 1 : -1;
    return (
      <group>
        {/* Outer Frame */}
        <mesh position={[xDir * 4, 7, 0]} castShadow><boxGeometry args={[0.4, 14, 0.4]} />{gateMat}</mesh>
        <mesh position={[xDir * 0.2, 7, 0]} castShadow><boxGeometry args={[0.4, 14, 0.4]} />{gateMat}</mesh>
        <mesh position={[xDir * 2.1, 0.2, 0]} castShadow><boxGeometry args={[4.2, 0.4, 0.4]} />{gateMat}</mesh>
        <mesh position={[xDir * 2.1, 13.8, 0]} castShadow><boxGeometry args={[4.2, 0.4, 0.4]} />{gateMat}</mesh>
        {/* Vertical Bars */}
        {[1, 1.8, 2.6, 3.4].map(bx => (
          <mesh key={bx} position={[xDir * bx, 7, 0]} castShadow><cylinderGeometry args={[0.08, 0.08, 13.6]} />{gateMat}</mesh>
        ))}
        {/* Ornate Gold Emblem */}
        <mesh position={[xDir * 2.1, 7, 0]} castShadow><torusGeometry args={[1.2, 0.1, 16, 64]} />{goldMat}</mesh>
        <mesh position={[xDir * 2.1, 7, 0]} castShadow><boxGeometry args={[2, 0.1, 0.1]} />{goldMat}</mesh>
      </group>
    );
  };

  return (
    <group position={[0, 0, -22]}>
      {/* Massive Stone Pillars holding the gates */}
      <mesh position={[-4.5, 7.5, 0]} castShadow><boxGeometry args={[2.5, 16, 2.5]} /><meshStandardMaterial color="#0f172a" roughness={0.8} /></mesh>
      <mesh position={[4.5, 7.5, 0]} castShadow><boxGeometry args={[2.5, 16, 2.5]} /><meshStandardMaterial color="#0f172a" roughness={0.8} /></mesh>
      
      {/* Left Door Pivot */}
      <group ref={L} position={[-3.25, -1, 0]}>
        <GateDoor side="L" />
        <mesh ref={symbols} position={[2.1, 7, 0.25]}><planeGeometry args={[3, 3]} /><meshBasicMaterial color="#3b82f6" transparent opacity={0} blending={THREE.AdditiveBlending} map={createSymbolTexture()} /></mesh>
      </group>
      
      {/* Right Door Pivot */}
      <group ref={R} position={[3.25, -1, 0]}>
        <GateDoor side="R" />
      </group>

      {/* Volumetric Light Burst Emitter (Behind Gate) */}
      <pointLight ref={burstLight} position={[0, 8, -5]} color="#60a5fa" intensity={0} distance={100} />
      <mesh ref={burst} position={[0, 8, -2]}>
        <planeGeometry args={[25, 25]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// Generate glowing symbol texture
function createSymbolTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#60a5fa';
  ctx.font = '80px serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚖', 128, 150);
  return new THREE.CanvasTexture(canvas);
}

/* ─── Realistic Human Character ─── */
function Human({ scene }) {
  const grp = useRef();
  const leftArm = useRef();
  const rightArm = useRef();
  const leftLeg = useRef();
  const rightLeg = useRef();
  const torso = useRef();
  const head = useRef();
  
  useFrame(({ clock }, dt) => {
    if (!grp.current) return;
    const t = clock.elapsedTime;
    let breath = Math.sin(t * 2) * 0.02;
    torso.current.position.y = 1.8 + breath;
    
    // Default resets
    grp.current.rotation.x = THREE.MathUtils.lerp(grp.current.rotation.x, 0, dt * 2);
    leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, dt * 2);
    rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, dt * 2);
    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 0, dt * 2);
    leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, dt * 2);
    rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, dt * 2);

    // Scene 2: Walk toward gate
    if (scene === 2) {
      grp.current.position.z = THREE.MathUtils.lerp(grp.current.position.z, -8, dt * 0.8);
      const walkCycle = t * 6;
      leftLeg.current.rotation.x = Math.sin(walkCycle) * 0.4;
      rightLeg.current.rotation.x = Math.sin(walkCycle + Math.PI) * 0.4;
      leftArm.current.rotation.x = Math.sin(walkCycle + Math.PI) * 0.3;
      rightArm.current.rotation.x = Math.sin(walkCycle) * 0.3;
      grp.current.position.y = -3.2 + Math.abs(Math.sin(walkCycle)) * 0.05;
    } 
    // Scene 7: Walk to push gate
    else if (scene === 7) {
      grp.current.position.z = THREE.MathUtils.lerp(grp.current.position.z, -18.5, dt * 0.8);
      const walkCycle = t * 6;
      leftLeg.current.rotation.x = Math.sin(walkCycle) * 0.4;
      rightLeg.current.rotation.x = Math.sin(walkCycle + Math.PI) * 0.4;
      // Arms raise to push
      leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, -1.6, dt * 2);
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -1.6, dt * 2);
      grp.current.rotation.x = THREE.MathUtils.lerp(grp.current.rotation.x, 0.25, dt * 2); // Lean forward with force
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -0.2, dt * 2); // Look up at gate
    }
    // Scene 4: Interacting with UI
    else if (scene === 4) {
      grp.current.position.z = THREE.MathUtils.lerp(grp.current.position.z, -8, dt * 2);
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -1.2, dt * 2);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 0.2, dt * 2);
      grp.current.position.y = THREE.MathUtils.lerp(grp.current.position.y, -3.2, dt * 2);
    } 
    // Scene 8+: Stand and watch gates open
    else if (scene >= 8) {
      grp.current.position.z = THREE.MathUtils.lerp(grp.current.position.z, -18.5, dt * 2);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -0.3, dt * 2); // Look up in awe
    }
  });

  const shirtMat = <meshStandardMaterial color="#ffffff" roughness={0.7} />; // Clean white shirt
  const pantsMat = <meshStandardMaterial color="#8b4513" roughness={0.8} />; // Brown pants
  const skinMat = <meshStandardMaterial color="#c8a27a" roughness={0.4} metalness={0.1} />;

  return (
    <group ref={grp} position={[0, -3.2, 4]}>
      {/* Legs */}
      <group ref={leftLeg} position={[-0.22, 1.0, 0]}>
        <mesh position={[0, -0.5, 0]} castShadow><capsuleGeometry args={[0.15, 1.0, 12, 16]} />{pantsMat}</mesh>
      </group>
      <group ref={rightLeg} position={[0.22, 1.0, 0]}>
        <mesh position={[0, -0.5, 0]} castShadow><capsuleGeometry args={[0.15, 1.0, 12, 16]} />{pantsMat}</mesh>
      </group>
      
      {/* Torso */}
      <group ref={torso} position={[0, 1.8, 0]}>
        <mesh castShadow><boxGeometry args={[0.8, 1.2, 0.45]} />{shirtMat}</mesh>
        
        {/* Left Arm */}
        <group ref={leftArm} position={[-0.55, 0.4, 0]}>
          <mesh position={[0, -0.5, 0]} castShadow><capsuleGeometry args={[0.14, 1.0, 12, 16]} />{shirtMat}</mesh>
          <mesh position={[0, -1.1, 0]} castShadow><sphereGeometry args={[0.12, 16, 16]} />{skinMat}</mesh>
        </group>
        
        {/* Right Arm */}
        <group ref={rightArm} position={[0.55, 0.4, 0]}>
          <mesh position={[0, -0.5, 0]} castShadow><capsuleGeometry args={[0.14, 1.0, 12, 16]} />{shirtMat}</mesh>
          <mesh position={[0, -1.1, 0]} castShadow><sphereGeometry args={[0.12, 16, 16]} />{skinMat}</mesh>
        </group>
        
        {/* Head */}
        <group ref={head} position={[0, 0.75, 0]}>
          <mesh castShadow position={[0, -0.1, 0]}><cylinderGeometry args={[0.12, 0.15, 0.2]} />{skinMat}</mesh>
          <mesh castShadow position={[0, 0.15, 0]}><sphereGeometry args={[0.3, 32, 32]} />{skinMat}</mesh>
          <mesh position={[0, 0.35, -0.05]}><sphereGeometry args={[0.32, 16, 16, 0, Math.PI*2, 0, Math.PI/1.8]} /><meshStandardMaterial color="#111" roughness={0.9} /></mesh>
        </group>
      </group>
    </group>
  );
}

/* ─── Anti-Gravity Debris ─── */
function AntiGravDebris({ scene }) {
  const particles = useRef([]);
  const count = 50;

  useMemo(() => {
    particles.current = Array.from({ length: count }, () => ({
      pos: new THREE.Vector3((Math.random() - 0.5) * 20, -3.2, (Math.random() - 0.5) * 20 - 15),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.4 + 0.1, (Math.random() - 0.5) * 0.1),
      rot: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
      type: Math.random() > 0.5 ? 'paper' : 'stone',
      delay: Math.random() * 2
    }));
  }, []);

  return particles.current.map((p, i) => <DebrisItem key={i} data={p} scene={scene} />);
}

function DebrisItem({ data, scene }) {
  const mesh = useRef();
  useFrame(({ clock }, dt) => {
    if (!mesh.current) return;
    // Scene 6+: Anti-gravity starts
    if (scene >= 6 && clock.elapsedTime > data.delay) {
      mesh.current.position.addScaledVector(data.vel, dt);
      mesh.current.rotation.x += data.rot.x * dt;
      mesh.current.rotation.y += data.rot.y * dt;
      data.vel.y += Math.sin(clock.elapsedTime * 2 + data.delay) * 0.005;
      if (mesh.current.position.y > 15) {
        data.vel.y *= 0.95; // Soft cap
      }
    }
  });

  if (data.type === 'paper') {
    return (
      <mesh ref={mesh} position={data.pos} castShadow>
        <planeGeometry args={[0.4, 0.5]} />
        <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
    );
  }
  return (
    <mesh ref={mesh} position={data.pos} castShadow>
      <dodecahedronGeometry args={[0.2]} />
      <meshStandardMaterial color="#475569" roughness={0.8} />
    </mesh>
  );
}

/* ─── Cinematic Camera ─── */
function Camera({ scene }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 2, -15));

  useFrame(({ mouse, clock }, dt) => {
    let pos, lookAt;
    const mx = mouse.x * 1.5;
    const my = mouse.y * 1.5;

    switch (scene) {
      case 0:
      case 1: // Establishing Wide (behind human)
        pos = new THREE.Vector3(3 + mx, 3 + my, 12);
        lookAt = new THREE.Vector3(0, 2, -15);
        break;
      case 2: // Human walking
        pos = new THREE.Vector3(4 + mx, 2 + my, 2);
        lookAt = new THREE.Vector3(0, 2, -15);
        break;
      case 3: 
      case 4: // Hologram appears, interacting
        pos = new THREE.Vector3(5 + mx, 2.5 + my, -2);
        lookAt = new THREE.Vector3(0, 2, -10);
        break;
      case 5:
      case 6: // Access granted, Anti-gravity
        pos = new THREE.Vector3(4 + mx, 3 + my, -4);
        lookAt = new THREE.Vector3(0, 5, -20);
        break;
      case 7: // Pushing Gate
        pos = new THREE.Vector3(3 + mx, 2 + my, -12);
        lookAt = new THREE.Vector3(0, 4, -22);
        break;
      case 8:
      case 9: // Gate opening & Light burst
        pos = new THREE.Vector3(0 + mx, 3 + my, -12);
        lookAt = new THREE.Vector3(0, 4, -30);
        break;
      case 10: // Fly through into AI world
        const progress = Math.min((clock.elapsedTime) * 0.4, 1);
        pos = new THREE.Vector3(0, 3, THREE.MathUtils.lerp(-12, -45, progress));
        lookAt = new THREE.Vector3(0, 3, -60);
        break;
      default:
        pos = new THREE.Vector3(3, 3, 12);
        lookAt = new THREE.Vector3(0, 2, -15);
    }

    camera.position.lerp(pos, dt * 1.5);
    look.current.lerp(lookAt, dt * 1.5);
    camera.lookAt(look.current);
  });
  return null;
}

/* ─── Main Export ─── */
export default function CourtroomScene({ scene, typingPulse }) {
  return (
    <div className="courtroom-canvas-container">
      <Canvas
        shadows
        camera={{ position: [3, 3, 12], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <DynamicEnvironment scene={scene} />
        
        {/* Environment Base */}
        <CourtyardFloor scene={scene} />
        <SupremeCourtDome />
        <IronGates scene={scene} />

        {/* Characters & FX */}
        <Human scene={scene} />
        <AntiGravDebris scene={scene} />

        {/* Particles */}
        <Sparkles count={150} scale={30} size={2} speed={0.2} opacity={0.3} color="#fbbf24" position={[0, 4, -10]} />
        {scene >= 8 && <Sparkles count={400} scale={40} size={4} speed={1.5} opacity={0.8} color="#60a5fa" position={[0, 5, -25]} />}

        <Camera scene={scene} />
      </Canvas>
    </div>
  );
}
