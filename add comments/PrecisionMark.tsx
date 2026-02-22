/**
 * PrecisionMark - Rich text formatting toolbar for comments
 *
 * Features:
 * - Appears when text is selected in the textarea
 * - Formatting buttons: bold, italic, underline, strikethrough, rainbow
 * - Color preset buttons for quick color selection
 * - Hue wheel for custom color selection (any color except white)
 * - Positions above the selected text
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Sparkles,
  Palette,
  ChevronDown,
  X,
} from 'lucide-react';

export interface PrecisionMarkProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onFormat: (prefix: string, suffix: string) => void;
  onWrapSelection: (wrapper: (text: string) => string) => void;
}

// Preset colors matching the comment system
const PRESET_COLORS = [
  { code: '&a', color: '#ef4444', label: 'Red' },
  { code: '&1', color: '#f97316', label: 'Orange' },
  { code: '&b', color: '#eab308', label: 'Yellow' },
  { code: '&2', color: '#84cc16', label: 'Lime' },
  { code: '&c', color: '#22c55e', label: 'Green' },
  { code: '&d', color: '#06b6d4', label: 'Cyan' },
  { code: '&3', color: '#38bdf8', label: 'Light Blue' },
  { code: '&4', color: '#3b82f6', label: 'Blue' },
  { code: '&e', color: '#6366f1', label: 'Indigo' },
  { code: '&5', color: '#a855f7', label: 'Purple' },
  { code: '&f', color: '#8b5cf6', label: 'Violet' },
  { code: '&6', color: '#ec4899', label: 'Pink' },
];

// Animated preset colors
const ANIMATED_COLORS = [
  { code: '&!a', color: '#ef4444', label: 'Glow Red' },
  { code: '&!1', color: '#f97316', label: 'Glow Orange' },
  { code: '&!b', color: '#eab308', label: 'Glow Yellow' },
  { code: '&!c', color: '#22c55e', label: 'Glow Green' },
  { code: '&!d', color: '#06b6d4', label: 'Glow Cyan' },
  { code: '&!4', color: '#3b82f6', label: 'Glow Blue' },
  { code: '&!5', color: '#a855f7', label: 'Glow Purple' },
  { code: '&!6', color: '#ec4899', label: 'Glow Pink' },
  { code: '&&', color: 'rainbow', label: 'Rainbow' },
];

interface Position {
  top: number;
  left: number;
}

export default function PrecisionMark({
  textareaRef,
  onFormat,
  onWrapSelection,
}: PrecisionMarkProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAnimatedColors, setShowAnimatedColors] = useState(false);
  const [customHue, setCustomHue] = useState(0);
  const [customSaturation, setCustomSaturation] = useState(100);
  const [customLightness, setCustomLightness] = useState(50);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hueWheelRef = useRef<HTMLCanvasElement>(null);
  const isDraggingHue = useRef(false);

  // Convert HSL to Hex
  const hslToHex = useCallback((h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }, []);

  // Get current custom color as hex
  const customColorHex = hslToHex(customHue, customSaturation, customLightness);

  // Check if color is too light (close to white)
  const isColorTooLight = customLightness > 85;

  // Draw hue wheel
  useEffect(() => {
    const canvas = hueWheelRef.current;
    if (!canvas || !showColorPicker) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 3;
    const innerRadius = outerRadius - 15;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hue wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180;
      const endAngle = ((angle + 1) * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }

    // Cut out center
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(250, 250, 250)';
    ctx.fill();

    // Draw current hue indicator
    const indicatorAngle = (customHue * Math.PI) / 180 - Math.PI / 2;
    const indicatorX = centerX + Math.cos(indicatorAngle) * (innerRadius + (outerRadius - innerRadius) / 2);
    const indicatorY = centerY + Math.sin(indicatorAngle) * (innerRadius + (outerRadius - innerRadius) / 2);

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `hsl(${customHue}, 100%, 50%)`;
    ctx.fill();
  }, [showColorPicker, customHue]);

  // Handle hue wheel interaction
  const handleHueWheelInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = hueWheelRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) - canvas.width / 2;
    const y = (e.clientY - rect.top) - canvas.height / 2;

    // Calculate angle
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    setCustomHue(Math.round(angle) % 360);
  }, []);

  // Mouse handlers for hue wheel
  const handleHueMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHue.current = true;
    handleHueWheelInteraction(e);
  }, [handleHueWheelInteraction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue.current) {
        handleHueWheelInteraction(e);
      }
    };

    const handleMouseUp = () => {
      isDraggingHue.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleHueWheelInteraction]);

  // Calculate position relative to viewport (fixed positioning)
  const updatePosition = useCallback(() => {
    const textarea = textareaRef.current;
    const toolbar = toolbarRef.current;
    if (!textarea) return;

    const textareaRect = textarea.getBoundingClientRect();
    // Use actual toolbar height if available, otherwise estimate
    const toolbarHeight = toolbar?.offsetHeight || 80;

    // Position well above the textarea
    setPosition({
      top: textareaRect.top - toolbarHeight - 15,
      left: textareaRect.left,
    });
  }, [textareaRef]);

  // Track text selection
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== end && document.activeElement === textarea) {
        updatePosition();
        setIsVisible(true);
      } else {
        // No selection - hide after a small delay to allow button clicks
        setTimeout(() => {
          if (textarea.selectionStart === textarea.selectionEnd) {
            setIsVisible(false);
            setShowColorPicker(false);
            setShowAnimatedColors(false);
          }
        }, 200);
      }
    };

    textarea.addEventListener('select', handleSelectionChange);
    textarea.addEventListener('mouseup', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);

    return () => {
      textarea.removeEventListener('select', handleSelectionChange);
      textarea.removeEventListener('mouseup', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
    };
  }, [textareaRef, updatePosition]);

  // Update position on scroll
  useEffect(() => {
    if (!isVisible) return;

    const handleScroll = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isVisible, updatePosition]);

  // Hide toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        const textarea = textareaRef.current;
        if (textarea && !textarea.contains(e.target as Node)) {
          setIsVisible(false);
          setShowColorPicker(false);
          setShowAnimatedColors(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [textareaRef]);

  // Format handlers - prevent default to avoid form submission
  const handleBold = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFormat('**', '**');
  };

  const handleItalic = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFormat('*', '*');
  };

  const handleUnderline = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFormat('__', '__');
  };

  const handleStrikethrough = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFormat('==', '==');
  };

  const handleRainbow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onWrapSelection((text) => `}}${text}\n`);
  };

  const handlePresetColor = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    onWrapSelection((text) => `${code}${text}`);
    setShowColorPicker(false);
    setShowAnimatedColors(false);
  };

  const handleCustomColor = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isColorTooLight) return;
    onWrapSelection((text) => `&[${customColorHex}]${text}`);
    setShowColorPicker(false);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    setShowColorPicker(false);
    setShowAnimatedColors(false);
  };

  const toggleColorPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
    setShowAnimatedColors(false);
  };

  const toggleAnimatedColors = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowAnimatedColors(!showAnimatedColors);
  };

  if (!isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className="precision-mark-toolbar"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="skeuo-footer-panel rounded-xl shadow-xl border border-neutral-300 p-2">
        {/* Header with branding */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-neutral-600 tracking-wide">PrecisionMark</span>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Formatting buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <ToolbarButton onClick={handleBold} title="Bold (**text**)">
            <Bold className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton onClick={handleItalic} title="Italic (*text*)">
            <Italic className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton onClick={handleUnderline} title="Underline (__text__)">
            <Underline className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton onClick={handleStrikethrough} title="Strikethrough (==text==)">
            <Strikethrough className="w-5 h-5" />
          </ToolbarButton>

          <div className="w-px h-6 bg-neutral-300 mx-1" />

          <ToolbarButton onClick={handleRainbow} title="Rainbow (}}text)">
            <Sparkles className="w-5 h-5 text-pink-500" />
          </ToolbarButton>

          <div className="w-px h-6 bg-neutral-300 mx-1" />

          {/* Color picker toggle */}
          <ToolbarButton
            onClick={toggleColorPicker}
            title="Colors"
            active={showColorPicker}
          >
            <Palette className="w-5 h-5" />
            <ChevronDown className={`w-3.5 h-3.5 ml-0.5 transition-transform ${showColorPicker ? 'rotate-180' : ''}`} />
          </ToolbarButton>
        </div>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div className="mt-2 pt-2 border-t border-neutral-200">
            {/* Preset colors - single row */}
            <div className="mb-2">
              <div className="text-xs font-medium text-neutral-500 mb-1.5">Colors</div>
              <div className="flex gap-1">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={(e) => handlePresetColor(e, preset.code)}
                    className="w-6 h-6 rounded border border-neutral-300 hover:border-neutral-500 hover:scale-110 transition-all"
                    style={{ backgroundColor: preset.color }}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            {/* Animated colors toggle */}
            <button
              type="button"
              onClick={toggleAnimatedColors}
              className="text-left text-xs font-medium text-neutral-500 hover:text-neutral-700 flex items-center gap-1 py-1"
            >
              <Sparkles className="w-3 h-3" />
              Animated
              <ChevronDown className={`w-3 h-3 transition-transform ${showAnimatedColors ? 'rotate-180' : ''}`} />
            </button>

            {showAnimatedColors && (
              <div className="mb-2">
                <div className="flex gap-1">
                  {ANIMATED_COLORS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={(e) => handlePresetColor(e, preset.code)}
                      className="w-6 h-6 rounded border border-neutral-300 hover:border-neutral-500 hover:scale-110 transition-all relative overflow-hidden"
                      style={{
                        background: preset.color === 'rainbow'
                          ? 'linear-gradient(90deg, #ff004c, #ff8a00, #ffd400, #22c55e, #06b6d4, #3b82f6, #a855f7)'
                          : preset.color,
                      }}
                      title={preset.label}
                    >
                      {preset.code !== '&&' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom color picker */}
            <div className="border-t border-neutral-200 pt-2 mt-2">
              <div className="text-xs font-medium text-neutral-500 mb-1.5">Custom Color</div>

              {/* Hue wheel */}
              <div className="flex items-start gap-3">
                <canvas
                  ref={hueWheelRef}
                  width={80}
                  height={80}
                  className="cursor-crosshair flex-shrink-0"
                  onMouseDown={handleHueMouseDown}
                />

                <div className="flex-1 space-y-2">
                  {/* Saturation slider */}
                  <div>
                    <label className="text-[10px] text-neutral-500 block">Sat</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customSaturation}
                      onChange={(e) => setCustomSaturation(Number(e.target.value))}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full h-2 rounded appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, hsl(${customHue}, 0%, ${customLightness}%), hsl(${customHue}, 100%, ${customLightness}%))`,
                      }}
                    />
                  </div>

                  {/* Lightness slider */}
                  <div>
                    <label className="text-[10px] text-neutral-500 block">Light</label>
                    <input
                      type="range"
                      min="10"
                      max="85"
                      value={customLightness}
                      onChange={(e) => setCustomLightness(Number(e.target.value))}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full h-2 rounded appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, hsl(${customHue}, ${customSaturation}%, 10%), hsl(${customHue}, ${customSaturation}%, 50%), hsl(${customHue}, ${customSaturation}%, 85%))`,
                      }}
                    />
                  </div>

                  {/* Preview and apply */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded border border-neutral-300"
                      style={{ backgroundColor: customColorHex }}
                    />
                    <div className="flex-1">
                      <div className="text-xs font-mono text-neutral-600">{customColorHex}</div>
                      {isColorTooLight && (
                        <div className="text-[10px] text-red-500">Too light</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCustomColor}
                      disabled={isColorTooLight}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        isColorTooLight
                          ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Toolbar button component
function ToolbarButton({
  onClick,
  title,
  active = false,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-all ${
        active
          ? 'bg-neutral-200 text-neutral-800 shadow-inner'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}
