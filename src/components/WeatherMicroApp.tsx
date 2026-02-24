import { useState, useEffect, useRef, useCallback } from 'react';

type WeatherMode = 'rain' | 'snow' | 'off';

interface Particle {
  x: number; y: number;
  z: number; v: number; o: number;
  phase: number;
  rot: number; rotS: number;
  arms: number;
}

interface Cfg { density: number; speed: number; wind: number; extra: number; jitter: number; }

const MODE_DEFAULTS: Record<'rain' | 'snow', Cfg> = {
  snow: { density: 400, speed: 25, wind: 0,  extra: 50, jitter: 20 },
  rain: { density: 400, speed: 15, wind: 5,  extra: 15, jitter: 15 },
};

interface WeatherMicroAppProps { onClose: () => void; }

export default function WeatherMicroApp({ onClose }: WeatherMicroAppProps) {
  const [mode, setModeState] = useState<WeatherMode>('snow');
  const [isRising, setIsRising] = useState(false);
  const [pos, setPos]   = useState({ x: 240, y: 110 });
  const [size, setSize] = useState({ w: 320, h: 0 }); // h=0 → auto
  const [cfg, setCfg]   = useState<Cfg>({ ...MODE_DEFAULTS.snow });

  // Refs so the rAF loop always reads latest values without restarts
  const modeRef     = useRef<WeatherMode>('snow');
  const cfgRef      = useRef<Cfg>(cfg);
  const isRisingRef = useRef(false);
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef      = useRef<number>(0);

  useEffect(() => { modeRef.current = mode; },     [mode]);
  useEffect(() => { cfgRef.current = cfg; },       [cfg]);
  useEffect(() => { isRisingRef.current = isRising; }, [isRising]);

  // ── Drag ──────────────────────────────────────────────────────────
  const dragRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  // ── Resize ────────────────────────────────────────────────────────
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number; dir: string } | null>(null);
  const winRef    = useRef<HTMLDivElement>(null);

  // ── Particle helpers ──────────────────────────────────────────────
  function mkParticle(randomY = false): Particle {
    const cw = canvasRef.current?.width  ?? window.innerWidth;
    const ch = canvasRef.current?.height ?? window.innerHeight;
    const z = Math.random();
    return {
      x: Math.random() * (cw + 600) - 300,
      y: randomY ? Math.random() * ch : (isRisingRef.current ? ch + 100 : -100),
      z, v: z * 0.8 + 0.2, o: z * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotS: (Math.random() - 0.5) * 0.05,
      arms: Math.floor(Math.random() * 3) + 4,
    };
  }

  function drawFlake(ctx: CanvasRenderingContext2D, p: Particle) {
    const sz = (cfgRef.current.extra / 5) * p.v;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.strokeStyle = `rgba(255,255,255,${p.o})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < p.arms; i++) {
      ctx.rotate((Math.PI * 2) / p.arms);
      ctx.beginPath();
      ctx.moveTo(0, 0);     ctx.lineTo(0, -sz);
      ctx.moveTo(0, -sz/2); ctx.lineTo(-sz/3, -sz/1.5);
      ctx.moveTo(0, -sz/2); ctx.lineTo( sz/3, -sz/1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Canvas mount (once) ───────────────────────────────────────────
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    function resize() {
      if (!canvasRef.current) return;
      canvasRef.current.width  = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = Array.from({ length: cfgRef.current.density }, () => mkParticle(true));

    const ctx = canvas.getContext('2d')!;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const m = modeRef.current;
      const c = cfgRef.current;
      const rising = isRisingRef.current;

      if (m !== 'off') {
        while (particlesRef.current.length < c.density) particlesRef.current.push(mkParticle(true));
        if (particlesRef.current.length > c.density) particlesRef.current.length = c.density;

        for (const p of particlesRef.current) {
          if (m === 'rain') {
            const vSpd = (rising ? -c.speed : c.speed) * (p.v * 1.8);
            const hSpd = c.wind * p.v;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(200,225,255,${p.o})`;
            ctx.lineWidth = p.z * 1.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - hSpd * (c.extra / 15), p.y - vSpd * (c.extra / 15));
            ctx.stroke();
            p.x += hSpd + Math.sin(p.phase) * (c.jitter / 20);
            p.y += vSpd;
          } else {
            const vSpd = (rising ? -c.speed : c.speed) * (p.v * 0.4);
            const hSpd = c.wind * p.v + Math.sin(p.phase) * (c.jitter / 10);
            drawFlake(ctx, p);
            p.x += hSpd; p.y += vSpd; p.rot += p.rotS;
          }
          p.phase += 0.05;
          if (
            (rising ? p.y < -150 : p.y > canvas.height + 150) ||
            p.x > canvas.width + 500 || p.x < -500
          ) { Object.assign(p, mkParticle()); }
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mode switch ───────────────────────────────────────────────────
  function setMode(m: WeatherMode) {
    setModeState(m);
    particlesRef.current = [];
    if (m !== 'off') setCfg({ ...MODE_DEFAULTS[m] });
  }

  // ── Titlebar drag ─────────────────────────────────────────────────
  const onTitleDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.wma-close')) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    e.preventDefault();
  }, [pos]);

  // ── Resize handle mousedown ───────────────────────────────────────
  const onResizeDown = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault(); e.stopPropagation();
    const el = winRef.current;
    if (!el) return;
    resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: el.offsetWidth, sh: el.offsetHeight, dir };
  }, []);

  // ── Global move / up ──────────────────────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (resizeRef.current) {
        const r = resizeRef.current;
        if (r.dir.includes('r')) setSize(s => ({ ...s, w: Math.max(240, r.sw + (e.clientX - r.sx)) }));
        if (r.dir.includes('b')) setSize(s => ({ ...s, h: Math.max(160, r.sh + (e.clientY - r.sy)) }));
      } else if (dragRef.current) {
        const d = dragRef.current;
        setPos({ x: Math.max(0, d.ox + (e.clientX - d.sx)), y: Math.max(0, d.oy + (e.clientY - d.sy)) });
      }
    }
    function onUp() { dragRef.current = null; resizeRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const sliders: { key: keyof Cfg; label: string; min: number; max: number }[] = [
    { key: 'density', label: 'Density',    min: 10,  max: 1000 },
    { key: 'speed',   label: 'Gravity',    min: 1,   max: 40   },
    { key: 'wind',    label: 'Wind Force', min: -40, max: 40   },
    { key: 'extra',   label: mode === 'snow' ? 'Complexity' : 'Streak', min: 1, max: 50 },
    { key: 'jitter',  label: 'Jitter',     min: 0,   max: 100  },
  ];

  return (
    <div
      ref={winRef}
      className="wma-window"
      style={{ left: pos.x, top: pos.y, width: size.w, ...(size.h ? { height: size.h } : {}) }}
    >
      {/* Titlebar */}
      <div className="wma-titlebar" onMouseDown={onTitleDown}>
        <span>⛅ System Weather Tuner</span>
        <button className="wma-close" onClick={onClose}>✕</button>
      </div>

      {/* Content */}
      <div className="wma-body">
        {/* Mode row */}
        <div className="wma-modes">
          {(['rain', 'snow', 'off'] as WeatherMode[]).map(m => (
            <button
              key={m}
              className={`wma-btn${mode === m ? ' wma-btn-active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'off' ? 'Off' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <button
            className={`wma-btn wma-rise${isRising ? ' wma-btn-active' : ''}`}
            onClick={() => setIsRising(r => !r)}
          >
            {isRising ? 'Fall' : 'Rise'}
          </button>
        </div>

        {/* Sliders */}
        <div className="wma-inset">
          {sliders.map(({ key, label, min, max }) => (
            <div key={key} className="wma-row">
              <span className="wma-lbl">{label}:</span>
              <input
                type="range" min={min} max={max} value={cfg[key]}
                onChange={e => setCfg(c => ({ ...c, [key]: +e.target.value }))}
              />
              <span className="wma-val">{cfg[key]}{key === 'jitter' ? '%' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resize handles */}
      <div className="wma-rsz wma-rsz-r"  onMouseDown={e => onResizeDown(e, 'r')}  />
      <div className="wma-rsz wma-rsz-b"  onMouseDown={e => onResizeDown(e, 'b')}  />
      <div className="wma-rsz wma-rsz-rb" onMouseDown={e => onResizeDown(e, 'rb')} />

      <style>{`
        .wma-window {
          position: fixed; z-index: 150;
          background: #c0c0c0;
          border: 2px solid; border-color: #fff #808080 #808080 #fff;
          box-shadow: 1px 1px 0 #000;
          font-family: 'MS Sans Serif', Arial, sans-serif;
          font-size: 11px; user-select: none;
          display: flex; flex-direction: column;
          min-width: 240px; min-height: 160px;
        }
        .wma-titlebar {
          background: linear-gradient(to right, #000080, #1084d0);
          color: #fff; padding: 3px 4px;
          display: flex; align-items: center; justify-content: space-between;
          font-weight: bold; font-size: 11px; cursor: default; flex-shrink: 0;
        }
        .wma-close {
          width: 16px; height: 14px; padding: 0;
          background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff;
          font-size: 9px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #000; line-height: 1;
        }
        .wma-close:active { border-color: #808080 #fff #fff #808080; padding: 1px 0 0 1px; }
        .wma-body { padding: 8px; flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
        .wma-modes { display: flex; gap: 4px; }
        .wma-rise { margin-left: auto; }
        .wma-btn {
          background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff;
          padding: 3px 8px; cursor: pointer; font-size: 11px;
          font-family: 'MS Sans Serif', Arial, sans-serif; color: #000;
        }
        .wma-btn:active, .wma-btn-active {
          border-color: #808080 #fff #fff #808080;
          background: #d0d0d0; padding: 4px 7px 2px 9px;
        }
        .wma-inset {
          border: 2px solid; border-color: #808080 #fff #fff #808080;
          background: #fff; padding: 8px;
          display: flex; flex-direction: column; gap: 5px;
        }
        .wma-row { display: flex; align-items: center; gap: 6px; }
        .wma-lbl { width: 82px; text-align: right; flex-shrink: 0; }
        .wma-row input[type=range] { flex: 1; height: 4px; cursor: pointer; }
        .wma-val { width: 34px; font-weight: bold; text-align: right; flex-shrink: 0; }
        .wma-rsz { position: absolute; background: transparent; }
        .wma-rsz-r  { top: 0; right: -3px; width: 5px; height: 100%; cursor: e-resize; }
        .wma-rsz-b  { bottom: -3px; left: 0; width: 100%; height: 5px; cursor: s-resize; }
        .wma-rsz-rb { bottom: -3px; right: -3px; width: 10px; height: 10px; cursor: se-resize; z-index: 1; }
      `}</style>
    </div>
  );
}
