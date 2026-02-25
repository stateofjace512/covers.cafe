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

export default function GradientTuner({ onClose }: GradientTunerProps) {
  const saved = getGradientPreference();
  const [start, setStart] = useState(saved.start);
  const [end, setEnd]     = useState(saved.end);
  const [pos,  setPos]    = useState({ x: 260, y: 120 });
  const [size, setSize]   = useState({ w: 300, h: 0 });

  const dragRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number; dir: string } | null>(null);
  const winRef    = useRef<HTMLDivElement>(null);

  // Live-preview while user drags the colour pickers
  function preview(s: string, e: string) {
    const theme = localStorage.getItem('theme') as ThemeName | null;
    if (theme === 'gradient') applyGradientColorsToDocument(s, e);
  }

  function handleSave() {
    setGradientPreference(start, end);
    // Apply gradient theme
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

  // Titlebar drag
  const onTitleDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.wma-close')) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    e.preventDefault();
  }, [pos]);

  // Resize handle mousedown
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

  const textColor = wcagTextColor(start, end);
  const isBright  = textColor === '#000000';

  return (
    <div
      ref={winRef}
      className="wma-window"
      style={{ left: pos.x, top: pos.y, width: size.w, ...(size.h ? { height: size.h } : {}) }}
    >
      {/* Titlebar */}
      <div className="wma-titlebar" onMouseDown={onTitleDown}>
        <span>🎨 Gradient Tuner</span>
        <button className="wma-close" onClick={onClose}>✕</button>
      </div>

      {/* Content */}
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

        {/* Colour rows */}
        <div className="wma-inset">
          <div className="wma-row">
            <span className="wma-lbl">Start:</span>
            <input
              type="color"
              value={start}
              className="gta-color-swatch"
              onChange={e => { setStart(e.target.value); preview(e.target.value, end); }}
            />
            <span className="wma-val gta-hex">{start}</span>
          </div>
          <div className="wma-row">
            <span className="wma-lbl">End:</span>
            <input
              type="color"
              value={end}
              className="gta-color-swatch"
              onChange={e => { setEnd(e.target.value); preview(start, e.target.value); }}
            />
            <span className="wma-val gta-hex">{end}</span>
          </div>
        </div>

        {/* Action row */}
        <div className="gta-actions">
          <button className="wma-btn" onClick={handleReset}>Reset</button>
          <button className="wma-btn wma-btn-active" onClick={handleSave}>Apply &amp; Save</button>
        </div>
      </div>

      {/* Resize handles */}
      <div className="wma-rsz wma-rsz-r"  onMouseDown={e => onResizeDown(e, 'r')}  />
      <div className="wma-rsz wma-rsz-b"  onMouseDown={e => onResizeDown(e, 'b')}  />
      <div className="wma-rsz wma-rsz-rb" onMouseDown={e => onResizeDown(e, 'rb')} />
    </div>
  );
}
