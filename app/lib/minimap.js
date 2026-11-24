const CONTROL_OR_DECL_RE =
  /^\s*(import|export|from|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|await|async|function|const|let|var|class|interface|type|enum|def|fn|pub|struct|impl|use|package|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/;

const COMMENT_RE = /^\s*(\/\/|\/\*|\*|#|<!--|--|;)/;
const TAG_RE = /^\s*<\/?[a-zA-Z!]/;
const STRING_LINE_RE = /(['"`])(?:\\.|(?!\1).)*\1/;
const NUMBER_RE = /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?\b/;
const FUNC_RE = /\b[a-zA-Z_$][\w$]*\s*\(/;

export function getMinimapPalette(theme = 'dark') {
  if (theme === 'light') {
    return {
      bg: '#ffffff',
      border: '#e5e5e5',
      sliderBg: 'rgba(100, 100, 100, 0.16)',
      sliderHoverBg: 'rgba(100, 100, 100, 0.28)',
      sliderBorder: 'rgba(100, 100, 100, 0.25)',
      activeLine: 'rgba(0, 0, 0, 0.05)',
      comment: 'rgba(0, 128, 0, 0.62)',
      keyword: 'rgba(175, 0, 219, 0.68)',
      tag: 'rgba(128, 0, 0, 0.68)',
      string: 'rgba(163, 21, 21, 0.65)',
      func: 'rgba(121, 94, 38, 0.72)',
      number: 'rgba(9, 134, 88, 0.68)',
      text: 'rgba(0, 16, 128, 0.55)',
      error: '#cd3131',
      warning: '#bf8803',
    };
  }
  return {
    bg: '#1e1e1e',
    border: '#2b2b2b',
    sliderBg: 'rgba(121, 121, 121, 0.22)',
    sliderHoverBg: 'rgba(121, 121, 121, 0.36)',
    sliderBorder: 'rgba(160, 160, 160, 0.24)',
    activeLine: 'rgba(255, 255, 255, 0.06)',
    comment: 'rgba(106, 153, 85, 0.7)',
    keyword: 'rgba(197, 134, 192, 0.75)',
    tag: 'rgba(86, 156, 214, 0.78)',
    string: 'rgba(206, 145, 120, 0.76)',
    func: 'rgba(220, 220, 170, 0.76)',
    number: 'rgba(181, 206, 168, 0.75)',
    text: 'rgba(156, 220, 254, 0.6)',
    error: '#f44747',
    warning: '#cca700',
  };
}

export function classifyLineTone(lineText) {
  if (!lineText || !lineText.trim()) return 'empty';
  if (COMMENT_RE.test(lineText)) return 'comment';
  if (TAG_RE.test(lineText)) return 'tag';
  if (CONTROL_OR_DECL_RE.test(lineText)) return 'keyword';
  if (STRING_LINE_RE.test(lineText)) return 'string';
  if (FUNC_RE.test(lineText)) return 'func';
  if (NUMBER_RE.test(lineText)) return 'number';
  return 'text';
}

export function computeLineSegments(lineText, maxCols = 64) {
  if (!lineText) return [];
  const clipped = lineText.slice(0, maxCols);
  const segments = [];
  let start = -1;

  for (let i = 0; i < clipped.length; i++) {
    const isSpace = clipped[i] === ' ' || clipped[i] === '\t';
    if (!isSpace && start === -1) {
      start = i;
    } else if (isSpace && start !== -1) {
      segments.push({ start, length: i - start });
      start = -1;
    }
  }
  if (start !== -1) {
    segments.push({ start, length: clipped.length - start });
  }
  return segments;
}

export function computeMinimapLayout({
  totalLines = 1,
  firstVisibleLine = 1,
  lastVisibleLine = 1,
  canvasHeight = 300,
  lineStepPx = 3,
}) {
  const safeTotal = Math.max(1, totalLines);
  const safeHeight = Math.max(40, canvasHeight);
  const naturalHeight = safeTotal * lineStepPx;
  const fitsInViewport = naturalHeight <= safeHeight;
  const contentHeight = fitsInViewport ? naturalHeight : safeHeight;
  const scaleY = fitsInViewport ? lineStepPx : safeHeight / safeTotal;

  const clampedFirst = Math.min(Math.max(1, firstVisibleLine), safeTotal);
  const clampedLast = Math.min(Math.max(clampedFirst, lastVisibleLine), safeTotal);
  const visibleSpan = Math.max(1, clampedLast - clampedFirst + 1);

  const rawTop = (clampedFirst - 1) * scaleY;
  const rawSliderHeight = visibleSpan * scaleY;
  const sliderHeight = Math.min(
    safeHeight,
    Math.max(18, Math.round(rawSliderHeight))
  );
  const maxSliderTop = Math.max(0, contentHeight - sliderHeight);
  const sliderTop = Math.min(maxSliderTop, Math.max(0, Math.round(rawTop)));

  return {
    totalLines: safeTotal,
    contentHeight,
    scaleY,
    sliderTop,
    sliderHeight,
    fitsInViewport,
  };
}

export function yToScrollRatio({ y, contentHeight, sliderHeight }) {
  const safeContent = Math.max(1, contentHeight);
  const effectiveTrack = Math.max(1, safeContent - Math.min(sliderHeight, safeContent * 0.85));
  const centeredY = y - sliderHeight / 2;
  if (safeContent <= sliderHeight) {
    return Math.min(1, Math.max(0, y / safeContent));
  }
  return Math.min(1, Math.max(0, centeredY / effectiveTrack));
}
