import { useState, useEffect, useRef, useCallback } from 'react';
import type { WeatherSettings, WeatherCfg, WeatherMode } from './WeatherCanvas';

const MODE_DEFAULTS: Record<'rain' | 'snow', WeatherCfg> = {
  snow: { density: 400, speed: 25, wind: 0,  extra: 50, jitter: 20 },
  rain: { density: 400, speed: 15, wind: 5,  extra: 15, jitter: 15 },
};

interface Props {
  initialSettings: WeatherSettings;
  /** Called on every slider / mode change so the live canvas updates in real-time. */
  onSettingsChange: (s: WeatherSettings) => void;
  /** Persist settings and close  -  canvas keeps running. */
  onSaveAndClose: (s: WeatherSettings) => void;
  /** Discard changes and close  -  caller reverts the canvas to saved state. */
  onClose: () => void;
}

export default function WeatherMicroApp({ initialSettings, onSettingsChange, onSaveAndClose, onClose }: Props) {
  const [mode, setModeState] = useState<WeatherMode>(initialSettings.mode);
  const [isRising, setIsRising] = useState(initialSettings.isRising);
  const [pos, setPos] = useState(() => {
    if (typeof window === 'undefined') return { x: 240, y: 110 };
    if (window.innerWidth <= 640) {
      return { x: Math.max(0, (window.innerWidth - 320) / 2), y: Math.max(0, (window.innerHeight - 400) / 2) };
    }
    return { x: 240, y: 110 };
  });
  const [size, setSize] = useState({ w: 320, h: 0 });
  const [cfg, setCfg] = useState<WeatherCfg>(initialSettings.cfg);

  // Propagate every change up so the live canvas stays in sync
  useEffect(() => {
    onSettingsChange({ mode, isRising, cfg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isRising, cfg]);

  const dragRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number; dir: string } | null>(null);
  const winRef    = useRef<HTMLDivElement>(null);

  function setMode(m: WeatherMode) {
    setModeState(m);
    if (m !== 'off') setCfg({ ...MODE_DEFAULTS[m] });
  }

  const onTitleDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.wma-close')) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    e.preventDefault();
  }, [pos]);

  const onResizeDown = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault(); e.stopPropagation();
    const el = winRef.current;
    if (!el) return;
    resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: el.offsetWidth, sh: el.offsetHeight, dir };
  }, []);

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

  const sliders: { key: keyof WeatherCfg; label: string; min: number; max: number }[] = [
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
      <div className="wma-titlebar" onMouseDown={onTitleDown}>
        <span>⛅ System Weather Tuner</span>
        <button className="wma-close" onClick={onClose}>✕</button>
      </div>

      <div className="wma-body">
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

        <div className="wma-actions">
          <button className="wma-btn wma-btn-active" onClick={() => onSaveAndClose({ mode, isRising, cfg })}>
            Save &amp; Close
          </button>
        </div>
      </div>

      <div className="wma-rsz wma-rsz-r"  onMouseDown={e => onResizeDown(e, 'r')}  />
      <div className="wma-rsz wma-rsz-b"  onMouseDown={e => onResizeDown(e, 'b')}  />
      <div className="wma-rsz wma-rsz-rb" onMouseDown={e => onResizeDown(e, 'rb')} />
    </div>
  );
}
