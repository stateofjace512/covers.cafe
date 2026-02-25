import { useState, useEffect, useRef, useCallback } from 'react';
import {
  applyGradientColorsToDocument,
  getGradientPreference,
  setGradientPreference,
  type ThemeName,
} from '../lib/userPreferences';

interface GradientTunerProps { onClose: () => void; }

const DEFAULT_START = '#4f46e5';
const DEFAULT_END   = '#db2777';

/** Same WCAG luminance calculation as in userPreferences.ts — duplicated here
 *  so the preview can run synchronously without importing the full module. */
function wcagTextColor(start: string, end: string): '#ffffff' | '#000000' {
  function toLinear(c: number) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
  function lum(hex: string) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return 0.5;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }
  const mid = (lum(start) + lum(end)) / 2;
  return (1.05 / (mid + 0.05)) >= ((mid + 0.05) / 0.05) ? '#ffffff' : '#000000';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [r, g, b] = hexToRgb(value);

  // Keep hex input in sync when value changes externally (e.g. Reset)
  useEffect(() => { setHexInput(value); }, [value]);

  function handleHexChange(raw: string) {
    setHexInput(raw);
    const norm = raw.startsWith('#') ? raw : '#' + raw;
    if (isValidHex(norm)) onChange(norm.toLowerCase());
  }

  function handleHexBlur() {
    const norm = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
    if (isValidHex(norm)) {
      setHexInput(norm.toLowerCase());
      onChange(norm.toLowerCase());
    } else {
      setHexInput(value); // revert
    }
  }

  function handleSlider(channel: 'r' | 'g' | 'b', val: number) {
    const nr = channel === 'r' ? val : r;
    const ng = channel === 'g' ? val : g;
    const nb = channel === 'b' ? val : b;
    const hex = rgbToHex(nr, ng, nb);
    setHexInput(hex);
    onChange(hex);
  }

  return (
    <div className="gta-picker">
      <div className="gta-picker-top">
        <div className="gta-swatch" style={{ background: value }} />
        <span className="gta-picker-label">{label}</span>
        <input
          className="gta-hex-input"
          value={hexInput}
          onChange={e => handleHexChange(e.target.value)}
          onBlur={handleHexBlur}
          spellCheck={false}
          maxLength={7}
        />
      </div>
      <div className="gta-slider-row">
        <span className="gta-slider-lbl">R</span>
        <input type="range" className="gta-range gta-range-r" min={0} max={255} value={r}
          onChange={e => handleSlider('r', +e.target.value)} style={{ '--gta-v': r } as React.CSSProperties} />
        <span className="gta-slider-val">{r}</span>
      </div>
      <div className="gta-slider-row">
        <span className="gta-slider-lbl">G</span>
        <input type="range" className="gta-range gta-range-g" min={0} max={255} value={g}
          onChange={e => handleSlider('g', +e.target.value)} style={{ '--gta-v': g } as React.CSSProperties} />
        <span className="gta-slider-val">{g}</span>
      </div>
      <div className="gta-slider-row">
        <span className="gta-slider-lbl">B</span>
        <input type="range" className="gta-range gta-range-b" min={0} max={255} value={b}
          onChange={e => handleSlider('b', +e.target.value)} style={{ '--gta-v': b } as React.CSSProperties} />
        <span className="gta-slider-val">{b}</span>
      </div>
    </div>
  );
}

export default function GradientTuner({ onClose }: GradientTunerProps) {
  const saved = getGradientPreference();
  const [start, setStart] = useState(saved.start);
  const [end, setEnd]     = useState(saved.end);
  const [pos,  setPos]    = useState(() => {
    if (typeof window === 'undefined') return { x: 260, y: 120 };
    if (window.innerWidth <= 640) {
      return { x: Math.max(0, (window.innerWidth - 300) / 2), y: Math.max(0, (window.innerHeight - 440) / 2) };
    }
    return { x: 260, y: 120 };
  });
  const [size, setSize]   = useState({ w: 300, h: 0 });

  const dragRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number; dir: string } | null>(null);
  const winRef    = useRef<HTMLDivElement>(null);

  function preview(s: string, e: string) {
    const theme = localStorage.getItem('theme') as ThemeName | null;
    if (theme === 'gradient') applyGradientColorsToDocument(s, e);
  }

  function handleStart(hex: string) { setStart(hex); preview(hex, end); }
  function handleEnd(hex: string)   { setEnd(hex);   preview(start, hex); }

  function handleSave() {
    setGradientPreference(start, end);
    document.documentElement.setAttribute('data-theme', 'gradient');
    localStorage.setItem('theme', 'gradient');
    applyGradientColorsToDocument(start, end);
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'gradient' }));
    onClose();
  }

  function handleReset() {
    setStart(DEFAULT_START);
    setEnd(DEFAULT_END);
    preview(DEFAULT_START, DEFAULT_END);
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
        if (r.dir.includes('r')) setSize(s => ({ ...s, w: Math.max(260, r.sw + (e.clientX - r.sx)) }));
        if (r.dir.includes('b')) setSize(s => ({ ...s, h: Math.max(200, r.sh + (e.clientY - r.sy)) }));
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

  const textColor = wcagTextColor(start, end);
  const isBright  = textColor === '#000000';

  return (
    <div
      ref={winRef}
      className="wma-window"
      style={{ left: pos.x, top: pos.y, width: size.w, ...(size.h ? { height: size.h } : {}) }}
    >
      <div className="wma-titlebar" onMouseDown={onTitleDown}>
        <span>Gradient Tuner</span>
        <button className="wma-close" onClick={onClose}>✕</button>
      </div>

      <div className="wma-body">
        {/* Gradient preview bar */}
        <div
          className="gta-preview"
          style={{ background: `linear-gradient(90deg, ${start} 0%, ${end} 100%)` }}
          aria-label="Gradient preview"
        >
          <span className="gta-preview-text" style={{ color: textColor }}>
            Preview — text will be {isBright ? 'dark' : 'white'}
          </span>
        </div>

        {/* Custom colour pickers */}
        <div className="wma-inset">
          <ColorPicker label="Start" value={start} onChange={handleStart} />
          <div className="gta-divider" />
          <ColorPicker label="End"   value={end}   onChange={handleEnd} />
        </div>

        <div className="gta-actions">
          <button className="wma-btn" onClick={handleReset}>Reset</button>
          <button className="wma-btn wma-btn-active" onClick={handleSave}>Apply &amp; Save</button>
        </div>
      </div>

      <div className="wma-rsz wma-rsz-r"  onMouseDown={e => onResizeDown(e, 'r')}  />
      <div className="wma-rsz wma-rsz-b"  onMouseDown={e => onResizeDown(e, 'b')}  />
      <div className="wma-rsz wma-rsz-rb" onMouseDown={e => onResizeDown(e, 'rb')} />
    </div>
  );
}
