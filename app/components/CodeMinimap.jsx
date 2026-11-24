'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyLineTone,
  computeLineSegments,
  computeMinimapLayout,
  getMinimapPalette,
  yToScrollRatio,
} from '../lib/minimap';
import { useI18n } from '../lib/LocaleContext';

export default function CodeMinimap({
  code,
  theme,
  viewport,
  activeLine = 1,
  diagnostics = [],
  onScrollToRatio,
  onWheelScroll,
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 72, height: 320 });
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const parsedLines = useMemo(() => {
    const rawLines = (typeof code === 'string' ? code : '').split('\n');
    // Cap per-line segment parsing cost on massive files while keeping full line count
    return rawLines.map((line) => ({
      tone: classifyLineTone(line),
      segments: computeLineSegments(line, 64),
    }));
  }, [code]);

  const totalLines = parsedLines.length;
  const palette = useMemo(() => getMinimapPalette(theme), [theme]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(48, Math.round(entry.contentRect.width));
        const h = Math.max(80, Math.round(entry.contentRect.height));
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      computeMinimapLayout({
        totalLines,
        firstVisibleLine: viewport?.firstVisibleLine || 1,
        lastVisibleLine: viewport?.lastVisibleLine || Math.min(totalLines, 30),
        canvasHeight: size.height,
        lineStepPx: 3,
      }),
    [totalLines, viewport?.firstVisibleLine, viewport?.lastVisibleLine, size.height]
  );

  // Render high-DPI minimap overview + diagnostics + viewport slider
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetW = Math.round(size.width * dpr);
    const targetH = Math.round(size.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear canvas with theme background
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, size.width, size.height);

    const drawPaddingLeft = 6;
    const drawAreaWidth = Math.max(24, size.width - drawPaddingLeft - 6);
    const colWidth = drawAreaWidth / 64;
    const blockHeight = Math.max(1, Math.min(2, layout.scaleY * 0.66));

    // Active line indicator band
    if (activeLine >= 1 && activeLine <= totalLines) {
      const ay = (activeLine - 1) * layout.scaleY;
      ctx.fillStyle = palette.activeLine;
      ctx.fillRect(0, ay, size.width, Math.max(2, layout.scaleY));
    }

    // Draw micro-glyphs for lines (sample stride on huge files for 60fps responsiveness)
    const stride = totalLines > size.height * 2 ? Math.max(1, Math.floor(totalLines / (size.height * 1.5))) : 1;
    for (let i = 0; i < totalLines; i += stride) {
      const item = parsedLines[i];
      if (!item || item.tone === 'empty') continue;
      const y = i * layout.scaleY;
      if (y > size.height) break;

      ctx.fillStyle = palette[item.tone] || palette.text;
      for (const seg of item.segments) {
        const x = drawPaddingLeft + seg.start * colWidth;
        const w = Math.max(1.5, seg.length * colWidth);
        ctx.fillRect(x, y, w, blockHeight);
      }
    }

    // Draw diagnostics ticks on right edge (errors & warnings)
    if (Array.isArray(diagnostics) && diagnostics.length > 0) {
      for (const d of diagnostics) {
        const lineIdx = Math.min(Math.max(1, d.line || 1), totalLines) - 1;
        const dy = Math.round(lineIdx * layout.scaleY);
        ctx.fillStyle = d.severity === 'warning' ? palette.warning : palette.error;
        ctx.fillRect(size.width - 4, dy, 4, Math.max(2, Math.round(layout.scaleY)));
      }
    }

    // Draw VS Code viewport slider overlay
    ctx.fillStyle = hovered || dragging ? palette.sliderHoverBg : palette.sliderBg;
    ctx.fillRect(0, layout.sliderTop, size.width, layout.sliderHeight);

    ctx.fillStyle = palette.sliderBorder;
    ctx.fillRect(0, layout.sliderTop, size.width, 1);
    ctx.fillRect(0, layout.sliderTop + layout.sliderHeight - 1, size.width, 1);

    ctx.restore();
  }, [size, palette, parsedLines, totalLines, layout, activeLine, diagnostics, hovered, dragging]);

  const scrubToClientY = (clientY) => {
    const el = containerRef.current;
    if (!el || !onScrollToRatio) return;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const ratio = yToScrollRatio({
      y,
      contentHeight: layout.contentHeight,
      sliderHeight: layout.sliderHeight,
    });
    onScrollToRatio(ratio);
  };

  return (
    <div
      ref={containerRef}
      data-testid="code-minimap"
      data-total-lines={totalLines}
      data-first-line={viewport?.firstVisibleLine || 1}
      data-last-line={viewport?.lastVisibleLine || totalLines}
      role="slider"
      tabIndex={0}
      aria-label={t('minimapAria')}
      aria-valuemin={1}
      aria-valuemax={Math.max(1, totalLines)}
      aria-valuenow={viewport?.firstVisibleLine || 1}
      title={t('minimapTitle')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDragging(true);
        scrubToClientY(e.clientY);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        scrubToClientY(e.clientY);
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
      onPointerCancel={() => setDragging(false)}
      onWheel={(e) => {
        onWheelScroll?.(e.deltaY);
      }}
      onKeyDown={(e) => {
        if (!onScrollToRatio) return;
        const curRatio = totalLines > 1 ? ((viewport?.firstVisibleLine || 1) - 1) / (totalLines - 1) : 0;
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          onScrollToRatio(Math.min(1, curRatio + 0.1));
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          onScrollToRatio(Math.max(0, curRatio - 0.1));
        } else if (e.key === 'Home') {
          e.preventDefault();
          onScrollToRatio(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          onScrollToRatio(1);
        }
      }}
      className="hidden sm:block w-[64px] md:w-[76px] xl:w-[84px] h-full shrink-0 border-l border-[#e5e5e5]/80 dark:border-[#2b2b2b] select-none cursor-pointer relative overflow-hidden"
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
    </div>
  );
}
