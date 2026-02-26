import { useEffect, useRef } from 'react';

export type WeatherMode = 'rain' | 'snow' | 'off';
export interface WeatherCfg { density: number; speed: number; wind: number; extra: number; jitter: number; }
export interface WeatherSettings { mode: WeatherMode; isRising: boolean; cfg: WeatherCfg; }

interface Particle {
  x: number; y: number;
  z: number; v: number; o: number;
  phase: number;
  rot: number; rotS: number;
  arms: number;
}

interface Props { settings: WeatherSettings; }

export default function WeatherCanvas({ settings }: Props) {
  const modeRef     = useRef<WeatherMode>(settings.mode);
  const cfgRef      = useRef<WeatherCfg>(settings.cfg);
  const isRisingRef = useRef(settings.isRising);
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef      = useRef<number>(0);

  // Sync latest settings into refs so the rAF loop always reads current values
  useEffect(() => { modeRef.current = settings.mode; particlesRef.current = []; }, [settings.mode]);
  useEffect(() => { cfgRef.current = settings.cfg; }, [settings.cfg]);
  useEffect(() => { isRisingRef.current = settings.isRising; }, [settings.isRising]);

  // Canvas + animation  -  mounted once, cleaned up on unmount
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    const mount = document.querySelector('.site-main') ?? document.body;
    mount.appendChild(canvas);
    canvasRef.current = canvas;

    function resize() {
      if (!canvasRef.current) return;
      canvasRef.current.width  = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

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

  return null;
}
