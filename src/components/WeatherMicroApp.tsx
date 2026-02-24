import { useState, useEffect, useRef, useCallback } from 'react';

export type WeatherMode = 'none' | 'rain' | 'snow';

interface Particle {
  x: number;
  y: number;
  speed: number;
  length: number;   // rain streak length
  radius: number;   // snow radius
  opacity: number;
  drift: number;
  wobble: number;   // snow wobble phase offset
}

interface WeatherMicroAppProps {
  onClose: () => void;
}

function createParticle(mode: WeatherMode, w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    speed: mode === 'rain' ? 9 + Math.random() * 7 : 0.8 + Math.random() * 1.4,
    length: 10 + Math.random() * 12,
    radius: 1.5 + Math.random() * 2.5,
    opacity: 0.35 + Math.random() * 0.45,
    drift: mode === 'rain' ? -1 + Math.random() * 2 : 0,
    wobble: Math.random() * Math.PI * 2,
  };
}

export default function WeatherMicroApp({ onClose }: WeatherMicroAppProps) {
  const [mode, setMode] = useState<WeatherMode>('none');
  const [pos, setPos] = useState({ x: 240, y: 110 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const frameRef = useRef<number>(0);

  // Canvas lifecycle — mount/unmount with mode
  useEffect(() => {
    if (mode === 'none') {
      cancelAnimationFrame(rafRef.current);
      canvasRef.current?.remove();
      canvasRef.current = null;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    function resize() {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const count = mode === 'rain' ? 180 : 90;
    particlesRef.current = Array.from({ length: count }, () =>
      createParticle(mode, canvas.width, canvas.height),
    );

    const ctx = canvas.getContext('2d')!;

    function animate() {
      frameRef.current++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        // Update
        p.y += p.speed;
        if (mode === 'rain') {
          p.x += p.drift;
        } else {
          p.wobble += 0.015;
          p.x += Math.sin(p.wobble) * 0.6 + p.drift * 0.3;
          p.y += Math.cos(p.wobble * 0.7) * 0.15;
        }
        // Wrap
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x > w + 10) p.x = -10;
        if (p.x < -10) p.x = w + 10;

        // Draw
        ctx.save();
        ctx.globalAlpha = p.opacity;
        if (mode === 'rain') {
          ctx.strokeStyle = 'rgba(180, 220, 255, 0.85)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.drift * 1.5, p.y + p.length);
          ctx.stroke();
        } else {
          // Snow: tiny filled square for Win95 feel, or circle
          ctx.fillStyle = 'rgba(225, 242, 255, 0.92)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvasRef.current?.remove();
      canvasRef.current = null;
    };
  }, [mode]);

  // Drag — titlebar mousedown
  const onTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.wma-close')) return;
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
      e.preventDefault();
    },
    [pos],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      setPos({
        x: Math.max(0, dragRef.current.ox + dx),
        y: Math.max(0, dragRef.current.oy + dy),
      });
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const MODES: { value: WeatherMode; label: string; icon: string }[] = [
    { value: 'none',  label: 'Clear',  icon: '☀' },
    { value: 'rain',  label: 'Rain',   icon: '🌧' },
    { value: 'snow',  label: 'Snow',   icon: '❄' },
  ];

  return (
    <div
      className="wma-window"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Titlebar */}
      <div className="wma-titlebar" onMouseDown={onTitleMouseDown}>
        <span className="wma-title-icon">⛅</span>
        <span className="wma-title-text">Weather</span>
        <button className="wma-close" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Body */}
      <div className="wma-body">
        <div className="wma-label">Select weather effect:</div>
        <div className="wma-options">
          {MODES.map(({ value, label, icon }) => (
            <button
              key={value}
              className={`wma-opt${mode === value ? ' wma-opt--on' : ''}`}
              onClick={() => setMode(value)}
            >
              <span className="wma-opt-icon">{icon}</span>
              <span className="wma-opt-label">{label}</span>
              {mode === value && <span className="wma-opt-pip" />}
            </button>
          ))}
        </div>
        {mode !== 'none' && (
          <div className="wma-status">
            {mode === 'rain' ? '🌧 Rain active' : '❄ Snow active'}
          </div>
        )}
      </div>

      <style>{`
        .wma-window {
          position: fixed;
          z-index: 150;
          min-width: 170px;
          background: var(--sidebar-bg);
          border: 2px solid;
          border-color: #ffffff #c07f55 #c07f55 #ffffff;
          user-select: none;
          font-family: var(--font-body);
        }
        [data-theme="dark"] .wma-window {
          background: #3d1a05;
          border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f;
        }
        .wma-titlebar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 3px;
          background: linear-gradient(90deg, var(--header-bg-dark) 0%, var(--header-bg) 55%, var(--header-bg-light) 100%);
          cursor: move;
        }
        .wma-title-icon {
          font-size: 13px;
          line-height: 1;
        }
        .wma-title-text {
          flex: 1;
          color: #fff8f0;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.3px;
        }
        .wma-close {
          background: var(--sidebar-bg);
          border: 2px solid;
          border-color: #ffffff #c07f55 #c07f55 #ffffff;
          color: var(--body-text);
          font-size: 9px;
          width: 16px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .wma-close:active {
          border-color: #c07f55 #ffffff #ffffff #c07f55;
        }
        [data-theme="dark"] .wma-close {
          background: #3d1a05;
          border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f;
          color: var(--body-text);
        }
        .wma-body {
          padding: 7px 8px 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .wma-label {
          font-size: 11px;
          color: var(--body-text);
          margin-bottom: 2px;
        }
        .wma-options {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .wma-opt {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 6px;
          background: var(--sidebar-bg);
          border: 2px solid;
          border-color: #ffffff #c07f55 #c07f55 #ffffff;
          color: var(--body-text);
          font-size: 12px;
          font-family: var(--font-body);
          cursor: pointer;
          text-align: left;
          width: 100%;
        }
        .wma-opt:active {
          border-color: #c07f55 #ffffff #ffffff #c07f55;
        }
        .wma-opt--on {
          background: var(--sidebar-active-bg);
          color: var(--sidebar-active-text);
          border-color: #c07f55 #ffffff #ffffff #c07f55;
        }
        [data-theme="dark"] .wma-opt {
          background: #3d1a05;
          border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f;
          color: var(--body-text);
        }
        [data-theme="dark"] .wma-opt--on {
          background: var(--sidebar-active-bg);
          color: var(--sidebar-active-text);
          border-color: #2a1505 #6b3d1f #6b3d1f #2a1505;
        }
        .wma-opt-icon {
          font-size: 14px;
          width: 18px;
          text-align: center;
          flex-shrink: 0;
        }
        .wma-opt-label {
          flex: 1;
        }
        .wma-opt-pip {
          width: 4px;
          height: 4px;
          background: #ffffff;
          flex-shrink: 0;
        }
        .wma-status {
          font-size: 10px;
          color: var(--body-text-muted);
          border-top: 1px solid var(--sidebar-border);
          padding-top: 4px;
          margin-top: 1px;
        }
      `}</style>
    </div>
  );
}
