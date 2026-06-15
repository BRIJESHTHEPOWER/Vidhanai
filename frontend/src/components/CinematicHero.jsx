import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdaptiveDpr,
  Float,
  Html,
  MeshReflectorMaterial,
  Sparkles,
} from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';

// ── M7: Mobile / reduced-motion detection ────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth <= 768 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setIsMobile(mq.matches || rm.matches);
    mq.addEventListener('change', update);
    rm.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
      rm.removeEventListener('change', update);
    };
  }, []);

  return isMobile;
}

// ── M7: Lightweight static hero for mobile / low-power devices ───────────────
function StaticHero({ onSearch, query, setQuery, onAsk }) {
  const QUICK_SEARCHES_STATIC = ['Stolen Phone', 'FIR Process', 'Bail Rights', 'Women Safety'];
  return (
    <section className="cinematic-3d-wrapper cinematic-static-hero">
      <div className="hero-static-bg" aria-hidden="true">
        <div className="hero-static-orb hero-static-orb--1" />
        <div className="hero-static-orb hero-static-orb--2" />
      </div>
      <div className="hero-ui-overlay command-ui">
        <motion.div
          className="hero-left command-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="hero-badge-3d">
            <span className="badge-dot" />
            AI-Powered Indian Legal Intelligence
          </div>
          <h1 className="hero-title-3d">
            Vidhan.ai Legal Command Center.
            <span className="hero-accent"> From question to justice path.</span>
          </h1>
          <p className="hero-subtitle-3d">
            Explore Indian law: your question becomes matched sections,
            rights, procedures, and next actions in simple language.
          </p>
          <div className="hero-search-wrap">
            <div className="hero-search-box">
              <svg className="search-ic" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="#00FFB2" strokeWidth="1.6" />
                <path d="M14 14l3 3" stroke="#00FFB2" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                className="hero-search-input"
                placeholder="Describe your legal situation..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch && onSearch()}
              />
              <button className="hero-search-btn" onClick={onSearch} type="button" aria-label="Search law">
                <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                  <path d="M4 10h12M11 5l5 5-5 5" stroke="#04110c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="popular-searches">
              <span className="pop-label">Try:</span>
              {QUICK_SEARCHES_STATIC.map((text) => (
                <button key={text} className="pop-chip" type="button"
                  onClick={() => { setQuery(text); onSearch && onSearch(text); }}>
                  {text}
                </button>
              ))}
            </div>
            <div className="hero-cta-row">
              <button className="hero-cta-btn primary" onClick={() => onAsk && onAsk('rag')} type="button">Ask AI</button>
              <button className="hero-cta-btn" onClick={() => onAsk && onAsk('comic')} type="button">Story Mode</button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


const NEON = '#00ffb2';
const CYAN = '#00d4ff';
const GOLD = '#d7b65d';
const INK = '#04110c';

const QUICK_SEARCHES = ['Stolen Phone', 'FIR Process', 'Bail Rights', 'Women Safety'];

function useCurve(points) {
  return useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    [points]
  );
}

function FlowTube({ points, color = NEON, radius = 0.018, opacity = 0.35 }) {
  const curve = useCurve(points);

  return (
    <mesh>
      <tubeGeometry args={[curve, 96, radius, 8, false]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.4}
        transparent
        opacity={opacity}
        roughness={0.35}
        metalness={0.15}
      />
    </mesh>
  );
}

function FlowPacket({ points, color = NEON, offset = 0, speed = 0.08, scale = 1 }) {
  const curve = useCurve(points);
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const progress = (clock.elapsedTime * speed + offset) % 1;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress);
    ref.current.position.copy(point);
    ref.current.rotation.y = Math.atan2(tangent.x, tangent.z);
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.085 * scale, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
          roughness={0.25}
        />
      </mesh>
      <pointLight color={color} intensity={0.8 * scale} distance={3} />
    </group>
  );
}

function LawDataStreams() {
  const streams = [
    {
      color: NEON,
      points: [[-7, -0.8, -7], [-4, 1.2, -9], [0, 0.7, -8], [3.1, 0.2, -6.2], [6, 1, -8]],
    },
    {
      color: CYAN,
      points: [[-6, 2.4, -12], [-2, 3.1, -10], [1.5, 1.6, -7.5], [3.4, 0.2, -5.8], [7, -0.5, -9]],
    },
    {
      color: GOLD,
      points: [[-4.5, -2.2, -5.8], [-1, -1.2, -6.8], [2.5, -0.4, -6.3], [5.4, -1.6, -7.5]],
    },
  ];

  return (
    <>
      {streams.map((stream, index) => (
        <group key={stream.color}>
          <FlowTube points={stream.points} color={stream.color} opacity={index === 2 ? 0.25 : 0.38} />
          {[0, 0.33, 0.66].map((offset) => (
            <FlowPacket
              key={offset}
              points={stream.points}
              color={stream.color}
              offset={offset + index * 0.11}
              speed={0.055 + index * 0.015}
              scale={index === 2 ? 0.8 : 1}
            />
          ))}
        </group>
      ))}
    </>
  );
}

function LegalNode({ position, title, tone = NEON, delay = 0 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + delay;
    ref.current.rotation.y = t * 0.18;
    ref.current.position.y = position[1] + Math.sin(t * 0.9) * 0.08;
  });

  return (
    <group ref={ref} position={position}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.08, 6]} />
        <meshStandardMaterial
          color="#071a12"
          emissive={tone}
          emissiveIntensity={0.28}
          roughness={0.5}
          metalness={0.7}
        />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <torusGeometry args={[0.45, 0.012, 8, 48]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={1.6} transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <Html position={[0, 0.72, 0]} center zIndexRange={[12, 0]}>
        <div className="legal-node-label">{title}</div>
      </Html>
    </group>
  );
}

function HoloCaseCard({ position, title, lines, tone = NEON, delay = 0 }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + delay;
    ref.current.rotation.y = Math.sin(t * 0.45) * 0.12;
    ref.current.position.y = position[1] + Math.sin(t * 0.7) * 0.12;
  });

  return (
    <group ref={ref} position={position}>
      <mesh>
        <boxGeometry args={[1.7, 1.05, 0.035]} />
        <meshPhysicalMaterial
          color="#06140f"
          emissive={tone}
          emissiveIntensity={0.18}
          roughness={0.2}
          metalness={0.4}
          transparent
          opacity={0.78}
        />
      </mesh>
      <mesh position={[-0.62, 0.34, 0.03]}>
        <boxGeometry args={[0.35, 0.04, 0.012]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={1.4} />
      </mesh>
      {lines.map((width, index) => (
        <mesh key={index} position={[-0.18, 0.12 - index * 0.18, 0.03]}>
          <boxGeometry args={[width, 0.035, 0.012]} />
          <meshStandardMaterial color="#b6d8c0" emissive={tone} emissiveIntensity={0.22} />
        </mesh>
      ))}
      <Html position={[0, -0.72, 0]} center zIndexRange={[10, 0]}>
        <div className="holo-card-label">{title}</div>
      </Html>
    </group>
  );
}

function JusticeCore({ pointer }) {
  const groupRef = useRef();
  const ringA = useRef();
  const ringB = useRef();
  const beamRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        pointer.current.x * 0.22 + Math.sin(t * 0.18) * 0.12,
        0.035
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, pointer.current.y * 0.08, 0.035);
    }
    if (ringA.current) ringA.current.rotation.z = t * 0.38;
    if (ringB.current) ringB.current.rotation.x = Math.PI / 2 + t * 0.26;
    if (beamRef.current) beamRef.current.scale.y = 1 + Math.sin(t * 1.5) * 0.12;
  });

  return (
    <group ref={groupRef} position={[3.1, -0.1, -6.3]} scale={1.25}>
      <mesh>
        <icosahedronGeometry args={[1.0, 2]} />
        <meshPhysicalMaterial
          color="#082015"
          emissive={NEON}
          emissiveIntensity={0.35}
          roughness={0.18}
          metalness={0.45}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.018, 8, 96]} />
        <meshStandardMaterial color={NEON} emissive={NEON} emissiveIntensity={1.6} transparent opacity={0.8} />
      </mesh>
      <mesh ref={ringB} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.92, 0.012, 8, 96]} />
        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.2} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[2.25, 0.01, 8, 128]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.9} transparent opacity={0.42} />
      </mesh>

      <group position={[0, -1.55, 0]}>
        <mesh ref={beamRef} position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.6, 12]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.55} metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 1.72, 0]}>
          <boxGeometry args={[1.9, 0.055, 0.055]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.55} metalness={0.8} roughness={0.25} />
        </mesh>
        {[-0.78, 0.78].map((x) => (
          <group key={x} position={[x, 1.34, 0]}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.012, 0.72, 8]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, -0.42, 0]}>
              <cylinderGeometry args={[0.36, 0.28, 0.05, 28]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.28} metalness={0.85} roughness={0.22} />
            </mesh>
          </group>
        ))}
      </group>

      <pointLight color={NEON} intensity={2.1} distance={8} />
      <pointLight color={CYAN} intensity={1.1} distance={7} position={[0, 1.4, 0]} />
    </group>
  );
}

function LawVault() {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.08;
  });

  return (
    <group ref={ref} position={[0.2, -2.35, -13]} scale={1.08}>
      <mesh receiveShadow>
        <boxGeometry args={[8.6, 3.2, 0.45]} />
        <meshStandardMaterial color="#07120d" emissive={NEON} emissiveIntensity={0.05} roughness={0.82} metalness={0.1} />
      </mesh>
      <mesh position={[0, 2.05, 0.1]}>
        <cylinderGeometry args={[0, 4.8, 1.2, 3]} />
        <meshStandardMaterial color="#0a1b12" emissive={GOLD} emissiveIntensity={0.09} roughness={0.7} />
      </mesh>
      {[-3.2, -1.9, -0.6, 0.6, 1.9, 3.2].map((x, index) => (
        <group key={x} position={[x, -0.05, 0.48]}>
          <mesh>
            <cylinderGeometry args={[0.13, 0.17, 2.6, 14]} />
            <meshStandardMaterial color="#0d2418" emissive={index % 2 ? CYAN : NEON} emissiveIntensity={0.12} roughness={0.55} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <boxGeometry args={[0.55, 0.14, 0.55]} />
            <meshStandardMaterial color="#13271c" emissive={GOLD} emissiveIntensity={0.18} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2].map((step) => (
        <mesh key={step} position={[0, -2.05 - step * 0.22, 0.88 + step * 0.62]}>
          <boxGeometry args={[9 - step * 0.7, 0.18, 0.62]} />
          <meshStandardMaterial color="#09130e" emissive={NEON} emissiveIntensity={0.03} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.35, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={384}
        mixBlur={0.74}
        mixStrength={38}
        depthScale={1.1}
        minDepthThreshold={0.35}
        maxDepthThreshold={1.3}
        color="#06100b"
        metalness={0.58}
        roughness={0.13}
      />
    </mesh>
  );
}

function CommandPanels() {
  return (
    <>
      <HoloCaseCard
        position={[-3.9, 1.2, -6.7]}
        title="Citizen Query"
        lines={[0.9, 1.1, 0.62]}
        tone={CYAN}
        delay={0.2}
      />
      <HoloCaseCard
        position={[-0.55, 2.4, -8.4]}
        title="Section Match"
        lines={[1.15, 0.72, 1.02]}
        tone={NEON}
        delay={0.8}
      />
      <HoloCaseCard
        position={[5.9, 1.5, -7.7]}
        title="Action Path"
        lines={[0.65, 1.2, 0.92]}
        tone={GOLD}
        delay={1.1}
      />
    </>
  );
}

function LegalConstellation() {
  return (
    <>
      <LegalNode position={[-5.7, -0.85, -7.3]} title="FIR" tone={CYAN} delay={0.1} />
      <LegalNode position={[-2.4, 0.2, -8.5]} title="IPC" tone={GOLD} delay={0.4} />
      <LegalNode position={[0.7, 1.12, -8.2]} title="BNS" tone={NEON} delay={0.7} />
      <LegalNode position={[6, -0.25, -7.6]} title="Rights" tone={CYAN} delay={1.0} />
      <LegalNode position={[4.8, 2.62, -10.2]} title="Aid" tone={GOLD} delay={1.3} />
    </>
  );
}

function SceneParticles() {
  const positions = useMemo(() => {
    return Array.from({ length: 44 }, (_, index) => {
      const angle = index * 1.71;
      const radius = 6 + (index % 7) * 0.7;
      return [
        Math.cos(angle) * radius,
        -1.6 + (index % 8) * 0.62,
        -6 - Math.sin(angle * 0.7) * 5 - (index % 5) * 0.8,
      ];
    });
  }, []);

  return (
    <>
      {positions.map((position, index) => (
        <Float key={index} speed={0.7 + (index % 5) * 0.12} floatIntensity={0.35} rotationIntensity={0.2}>
          <mesh position={position} rotation={[index * 0.2, index * 0.13, index * 0.07]}>
            <boxGeometry args={[0.08, 0.34 + (index % 3) * 0.08, 0.018]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? CYAN : index % 3 === 1 ? NEON : GOLD}
              emissive={index % 3 === 0 ? CYAN : index % 3 === 1 ? NEON : GOLD}
              emissiveIntensity={0.9}
              transparent
              opacity={0.55}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function CameraRig({ pointer, scrollProgress }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(1.7, -0.15, -8.2));
  const eased = useRef({ x: 0, y: 0 });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    eased.current.x = THREE.MathUtils.lerp(eased.current.x, pointer.current.x, 0.035);
    eased.current.y = THREE.MathUtils.lerp(eased.current.y, pointer.current.y, 0.035);

    const scrollPush = scrollProgress.current;
    const x = 0.7 + eased.current.x * 1.05 + Math.sin(t * 0.18) * 0.16;
    const y = 0.8 + eased.current.y * 0.48 + Math.cos(t * 0.22) * 0.08 + scrollPush * 0.35;
    const z = 6.4 - scrollPush * 2.1;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, x, 0.022);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, y, 0.022);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, z, 0.022);
    camera.lookAt(target.current);
  });

  return null;
}

export default function CinematicHero({ onSearch, query, setQuery, onAsk }) {
  const isMobile     = useIsMobile();  // M7: mobile / reduced-motion check
  const pointer      = useRef({ x: 0, y: 0 });
  const scrollProgress = useRef(0);

  // M7: Bail out to static hero on mobile / reduced-motion
  if (isMobile) {
    return <StaticHero onSearch={onSearch} query={query} setQuery={setQuery} onAsk={onAsk} />;
  }


  useEffect(() => {
    const onScroll = () => {
      scrollProgress.current = Math.min(window.scrollY / 420, 1);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.current.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  const resetPointer = () => {
    pointer.current.x = 0;
    pointer.current.y = 0;
  };

  return (
    <section className="cinematic-3d-wrapper command-world" onMouseMove={handleMouseMove} onMouseLeave={resetPointer}>
      <Canvas
        shadows
        dpr={[1, 1.65]}
        performance={{ min: 0.55 }}
        camera={{ position: [0.7, 0.8, 6.4], fov: 50 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[INK]} />
        <fog attach="fog" args={['#03100b', 8, 38]} />
        <AdaptiveDpr />

        <ambientLight intensity={0.25} color="#7edfc5" />
        <directionalLight
          position={[6, 10, 4]}
          intensity={1.35}
          color="#e9c46a"
          castShadow
          shadow-mapSize={[1536, 1536]}
          shadow-camera-far={45}
          shadow-camera-left={-16}
          shadow-camera-right={16}
        />
        <pointLight position={[-5, 3, -3]} intensity={1.7} color={CYAN} distance={18} />
        <pointLight position={[4, 3, -4]} intensity={1.9} color={NEON} distance={18} />
        <pointLight position={[5, -1, -7]} intensity={1.05} color={GOLD} distance={14} />

        <Ground />
        <LawVault />
        <LawDataStreams />
        <LegalConstellation />
        <CommandPanels />
        <JusticeCore pointer={pointer} />
        <SceneParticles />

        <Sparkles count={130} scale={[34, 16, 26]} size={0.75} color={NEON} speed={0.08} opacity={0.2} />
        <Sparkles count={54} scale={[18, 10, 14]} size={1.3} color={GOLD} speed={0.055} opacity={0.2} position={[3, 1, -7]} />

        <CameraRig pointer={pointer} scrollProgress={scrollProgress} />
      </Canvas>

      <div className="hero-depth-vignette" />
      <div className="hero-grid-overlay" />
      <div className="hero-scanline" />

      <div className="hero-ui-overlay command-ui">
        <motion.div
          className="hero-left command-panel"
          initial={{ opacity: 0, x: -34 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
        >
          <div className="hero-badge-3d">
            <span className="badge-dot" />
            Live 3D Legal Intelligence System
          </div>

          <h1 className="hero-title-3d">
            Vidhan.ai Legal Command Center.
            <span className="hero-accent"> From question to justice path.</span>
          </h1>

          <p className="hero-subtitle-3d">
            Explore Indian law as a living 3D map: your question becomes matched sections,
            rights, procedures, and next actions in simple language.
          </p>

          <div className="hero-search-wrap">
            <div className="hero-search-box">
              <svg className="search-ic" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="#00FFB2" strokeWidth="1.6" />
                <path d="M14 14l3 3" stroke="#00FFB2" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                className="hero-search-input"
                placeholder="Describe your legal situation..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSearch && onSearch()}
              />
              <button className="hero-search-btn" onClick={onSearch} type="button" aria-label="Search law">
                <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                  <path d="M4 10h12M11 5l5 5-5 5" stroke="#04110c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="popular-searches">
              <span className="pop-label">Try:</span>
              {QUICK_SEARCHES.map((text) => (
                <button
                  key={text}
                  className="pop-chip"
                  type="button"
                  onClick={() => {
                    setQuery(text);
                    onSearch && onSearch(text);
                  }}
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="hero-cta-row">
              <button className="hero-cta-btn primary" onClick={() => onAsk && onAsk('rag')} type="button">
                Ask AI
              </button>
              <button className="hero-cta-btn" onClick={() => onAsk && onAsk('comic')} type="button">
                Story Mode
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="hero-system-strip">
        <span>Query intake</span>
        <span>Section matching</span>
        <span>Rights guidance</span>
        <span>Action path</span>
      </div>

      <div className="scroll-hint">
        <div className="scroll-hint-dot" />
        <span>Scroll to explore</span>
      </div>
    </section>
  );
}
