import { useRef, useEffect } from 'react';

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

/**
 * Magic UI — Particles
 * Canvas-based floating particle field.
 * Particles drift slowly and are gently attracted to the mouse cursor.
 * All drawing is off-main-thread-friendly (RAF + canvas 2D).
 */
export function Particles({
  quantity   = 80,
  size       = 0.6,
  color      = '#ffffff',
  staticity  = 50,
  ease       = 50,
  className  = '',
}) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const stateRef  = useRef({ W: 0, H: 0, particles: [], rgb: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s   = stateRef.current;
    s.rgb     = hexToRgb(color);

    function resize() {
      s.W = canvas.offsetWidth;
      s.H = canvas.offsetHeight;
      canvas.width  = Math.round(s.W * dpr);
      canvas.height = Math.round(s.H * dpr);
      ctx.scale(dpr, dpr);
      spawnParticles();
    }

    function spawnParticles() {
      s.particles = Array.from({ length: quantity }, () => ({
        x:  Math.random() * s.W,
        y:  Math.random() * s.H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r:  Math.random() * size + size * 0.35,
        alpha:     Math.random() * 0.45 + 0.10,
        magnetism: 0.1 + Math.random() * 3.5,
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, s.W, s.H);
      const { r: cr, g: cg, b: cb } = s.rgb;
      const attractForce = ease / staticity;

      for (const p of s.particles) {
        /* gentle drift */
        p.x += p.vx;
        p.y += p.vy;

        /* soft mouse attraction in a 180px radius */
        const dx   = mouseRef.current.x - p.x;
        const dy   = mouseRef.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 0) {
          const f = attractForce * p.magnetism * 0.18;
          p.x += (dx / dist) * f;
          p.y += (dy / dist) * f;
        }

        /* wrap edges */
        if (p.x < -p.r) p.x = s.W + p.r;
        if (p.x > s.W + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = s.H + p.r;
        if (p.y > s.H + p.r) p.y = -p.r;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.alpha})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onMouse(e) {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    if (prefersReducedMotion) {
      /* Draw one static frame — no drift, no mouse-tracking listener. */
      ctx.clearRect(0, 0, s.W, s.H);
      const { r: cr, g: cg, b: cb } = s.rgb;
      for (const p of s.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.alpha})`;
        ctx.fill();
      }
      return () => ro.disconnect();
    }

    tick();
    window.addEventListener('mousemove', onMouse, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouse);
    };
  }, [quantity, size, color, staticity, ease]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
