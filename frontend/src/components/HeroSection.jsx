/**
 * HeroSection — World-Class Premium SaaS Hero
 * Apple/Stripe/OpenAI Aesthetic
 */
import React, { useEffect, useRef } from 'react';
import './HeroSection.css';

const FRAME_COUNT = 192;
const FPS = 30;

const getFrameSrc = (i) =>
  `/ezgif-6734d02e00a57b4b-jpg/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;

/* ─────────────────────────────────────────────
   Cinematic Background Canvas
───────────────────────────────────────────── */
function CinematicCanvas() {
  const canvasRef = useRef(null);
  const images = useRef({});
  const raf = useRef(null);
  const currentFrame = useRef(1);
  const direction = useRef(1);
  const lastDrawTime = useRef(0);
  const isLoaded = useRef(false);

  const draw = (index) => {
    const canvas = canvasRef.current;
    const img = images.current[index];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    if (canvas.width !== img.naturalWidth) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(img, 0, 0);
  };

  const loop = (time) => {
    if (!lastDrawTime.current) lastDrawTime.current = time;
    const elapsed = time - lastDrawTime.current;

    if (elapsed > 1000 / FPS) {
      currentFrame.current += direction.current;
      if (currentFrame.current >= FRAME_COUNT) {
        currentFrame.current = FRAME_COUNT;
        direction.current = -1;
      } else if (currentFrame.current <= 1) {
        currentFrame.current = 1;
        direction.current = 1;
      }
      draw(currentFrame.current);
      lastDrawTime.current = time;
    }
    raf.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    let cancelled = false;
    let loadedCount = 0;

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        images.current[i] = img;
        loadedCount++;

        if (i === 1) draw(1);

        if (loadedCount === 10 && !isLoaded.current) {
          isLoaded.current = true;
          raf.current = requestAnimationFrame(loop);
        }
      };
      img.src = getFrameSrc(i);
    }

    return () => {
      cancelled = true;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []); // eslint-disable-line

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}

/* ─────────────────────────────────────────────
   Particle System (Subtle Depth)
───────────────────────────────────────────── */
function ParticlesCanvas() {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles.current = [];
      const count = Math.min(window.innerWidth / 15, 60); // Responsive count
      for (let i = 0; i < count; i++) {
        particles.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          speedY: Math.random() * 0.3 + 0.1,
          opacity: Math.random() * 0.4 + 0.1
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach(p => {
        p.y -= p.speedY;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        ctx.fillStyle = `rgba(165, 180, 252, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      raf.current = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-particles" aria-hidden="true" />;
}

/* ─────────────────────────────────────────────
   HeroSection (Main Layout)
───────────────────────────────────────────── */
export default function HeroSection() {

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="home" className="hero-section">
      
      {/* ── Background Layer (Z-Index 0) ── */}
      <CinematicCanvas />

      {/* ── Particles Layer (Z-Index 0.5) ── */}
      <ParticlesCanvas />

      {/* ── Cinematic Overlay (Z-Index 1) ── */}
      {/* Heavy vignette to crush edge noise and highlight center */}
      <div className="hero-vignette" />
      <div className="hero-bottom-fade" />
      
      {/* Glowing backdrop specifically behind text */}
      <div className="hero-text-glow" />

      {/* ── Content Layer (Z-Index 2) ── */}
      <div className="hero-center">
        

        <div className="hero-content">
          
          {/* Badge */}
          <div className="hero-badge hero-anim-1">
            <span className="hero-badge-pulse" />
            The Future of Legal Tech
          </div>

          {/* Headline */}
          <h1 className="hero-title hero-anim-1">
            Wield the Power to<br/>
            <span className="hero-title-animated">Decode the Law.</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle hero-anim-2">
            Instantly navigate the complexities of Indian Law.<br/>
            Decode BNS, IPC, and Constitutional rights with absolute precision and clarity.
          </p>

          {/* CTA Button */}
          <div className="hero-cta-group hero-anim-2">
            <button className="hero-btn-primary" onClick={() => scrollTo('explore')}>
              <span className="btn-icon">⚖️</span>
              Explore Laws
              <svg className="btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>



        </div>
      </div>
    </section>
  );
}
