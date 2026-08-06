import React, { useRef, useEffect } from 'react';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
}

const InteractiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const spacing = 45; // Space between dots
    const radius = 1.2; // Size of dots
    const forceRadius = 130; // Mouse interaction radius
    const forceFactor = 3.5; // Push force
    const returnSpeed = 0.08; // Damping return to home

    const init = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      particles = [];

      const cols = Math.floor(w / spacing) + 2;
      const rows = Math.floor(h / spacing) + 2;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * spacing;
          const y = r * spacing;
          particles.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: 0,
            vy: 0,
          });
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      // Adjust dot color based on theme
      ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(37, 99, 235, 0.09)';

      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Interaction with mouse
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < forceRadius) {
            const angle = Math.atan2(dy, dx);
            // Push force diminishes with distance
            const force = (forceRadius - dist) / forceRadius;
            const pushX = Math.cos(angle) * force * forceFactor * -5;
            const pushY = Math.sin(angle) * force * forceFactor * -5;

            p.vx += pushX;
            p.vy += pushY;
          }
        }

        // Return force to return back home
        const returnX = (p.baseX - p.x) * returnSpeed;
        const returnY = (p.baseY - p.y) * returnSpeed;

        p.vx += returnX;
        p.vy += returnY;

        // Apply friction to dampen oscillation
        p.vx *= 0.82;
        p.vy *= 0.82;

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    init();
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        width: '100vw',
        height: '100vh',
      }}
    />
  );
};

export default InteractiveBackground;
