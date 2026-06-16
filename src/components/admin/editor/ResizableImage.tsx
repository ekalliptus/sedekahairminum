// Resizable, alignable image node for the article editor.
// Stores width (px) + alignment (left|center|right) on the node; rendered the
// same way on the public article page. Provides:
//   - corner drag-handles (preserve aspect ratio)
//   - a small floating toolbar: presets 25/50/75/100% + align buttons
// Built as a TipTap React NodeView over the standard Image extension so no
// third-party resize dependency is needed.
import * as React from 'react';
import Image from '@tiptap/extension-image';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { Icon } from '../icon';

type Align = 'left' | 'center' | 'right';

const PRESETS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
];

function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, width, align } = node.attrs as {
    src: string; alt?: string; width?: number; align?: Align;
  };
  const alignVal: Align = align ?? 'center';
  const imgRef = React.useRef<HTMLImageElement>(null);
  const startRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);

  function onLoad() {
    const img = imgRef.current;
    if (img && (img.naturalWidth || img.naturalHeight)) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }

  function applyWidth(px: number) {
    const max = 1000;
    const clamped = Math.max(60, Math.min(px, max));
    updateAttributes({ width: clamped });
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: img.offsetWidth,
      h: img.offsetHeight,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = startRef.current;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    // Scale proportionally from the larger axis movement so aspect ratio holds.
    const dy = Math.abs(e.clientY - start.y);
    const delta = Math.max(dx, dy);
    applyWidth(start.w + (e.clientX > start.x || e.clientY > start.y ? delta : -delta));
  }

  function onPointerUp(e: React.PointerEvent) {
    startRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  const displayWidth = width ? `${width}px` : '100%';

  return (
    <NodeViewWrapper
      className="riw"
      data-align={alignVal}
      style={{ textAlign: alignVal, position: 'relative' }}
    >
      <figure
        className={`riw__figure${selected ? ' riw__figure--selected' : ''}`}
        style={{ display: 'inline-block', margin: '0.5em 0', maxWidth: '100%' }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ''}
          onLoad={onLoad}
          draggable={false}
          style={{ width: displayWidth, maxWidth: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
        />
        {/* Resize handles (corners) */}
        {['nw', 'ne', 'sw', 'se'].map((corner) => (
          <span
            key={corner}
            className={`riw__handle riw__handle--${corner}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        ))}
      </figure>

      {/* Floating toolbar: presets + alignment */}
      <div className="riw__toolbar" contentEditable={false}>
        {PRESETS.map((p) => {
          const targetPx = natural ? Math.round((p.value / 100) * natural.w) : 0;
          const active = width != null && natural != null && Math.round((width / natural.w) * 100) === p.value;
          return (
            <button
              key={p.value}
              type="button"
              className={`riw__btn${active ? ' riw__btn--active' : ''}`}
              onClick={() => natural && applyWidth(targetPx)}
              title={`Lebar ${p.label}`}
            >{p.label}</button>
          );
        })}
        <span className="riw__sep" />
        {(['left', 'center', 'right'] as Align[]).map((a) => (
          <button
            key={a}
            type="button"
            className={`riw__btn riw__btn--icon${alignVal === a ? ' riw__btn--active' : ''}`}
            onClick={() => updateAttributes({ align: a })}
            title={`Rata ${a}`}
          >
            <Icon name={`align-${a}`} />
          </button>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: (el) => Number(el.getAttribute('width')) || null,
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}) },
      align: {
        default: 'center',
        parseHTML: (el) => (el.getAttribute('data-align') as Align) || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align ?? 'center' }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
