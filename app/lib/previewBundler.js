// In-browser multi-file bundler, offline React/JSX runtime shim, and empty-body live preview support

import { transform } from 'sucrase';
import { isMediaEntry } from './storage';

export function escapeInlineScript(code = '') {
  return String(code).replace(/<\/(script)/gi, '<\\/$1');
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isScriptFile(path = '') {
  return /\.(js|mjs|cjs|jsx|ts|tsx)$/i.test(path);
}

export function isStyleFile(path = '') {
  return /\.(css|scss|sass|less)$/i.test(path);
}

export function isHtmlFile(path = '') {
  return /\.(html|htm)$/i.test(path);
}

export function isNonAppWorkspaceFile(path = '') {
  const p = String(path || '');
  return (
    /(?:^|\/)(?:dist|node_modules|\.next|\.git)\//i.test(p) ||
    /^app\/api\//i.test(p) ||
    /\.(?:test|spec)\.[^/]+$/i.test(p) ||
    /^(?:next|tailwind|postcss|vite|eslint|jest|vitest|babel)\.config\.[^/]+$/i.test(p) ||
    /-copy\d*\.(?:js|mjs|cjs|jsx|ts|tsx)$/i.test(p)
  );
}

// Lightweight offline Tailwind-compatible utility baseline for JSX/HTML classes without network access
export const TAILWIND_SHIM_CSS = `
.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}.block{display:block}.inline-block{display:inline-block}.hidden{display:none}
.flex-col{flex-direction:column}.flex-row{flex-direction:row}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}
.items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}
.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-5{gap:1.25rem}.gap-6{gap:1.5rem}.gap-8{gap:2rem}
.space-y-2>*+*{margin-top:.5rem}.space-y-3>*+*{margin-top:.75rem}.space-y-4>*+*{margin-top:1rem}.space-y-6>*+*{margin-top:1.5rem}
.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-6{padding:1.5rem}.p-8{padding:2rem}
.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}
.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\\.5{padding-top:.375rem;padding-bottom:.375rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-4{padding-top:1rem;padding-bottom:1rem}.py-8{padding-top:2rem;padding-bottom:2rem}
.m-0{margin:0}.mx-auto{margin-left:auto;margin-right:auto}.mt-2{margin-top:.5rem}.mt-4{margin-top:1rem}.mt-6{margin-top:1.5rem}.mb-2{margin-bottom:.5rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}
.w-full{width:100%}.h-full{height:100%}.min-h-screen{min-height:100vh}.max-w-md{max-width:28rem}.max-w-lg{max-width:32rem}.max-w-xl{max-width:36rem}.max-w-2xl{max-width:42rem}.max-w-4xl{max-width:56rem}.max-w-6xl{max-width:72rem}
.rounded{border-radius:.25rem}.rounded-md{border-radius:.375rem}.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}
.border{border-width:1px;border-style:solid;border-color:#e2e8f0}.border-slate-200{border-color:#e2e8f0}.border-slate-700{border-color:#334155}.border-slate-800{border-color:#1e293b}
.shadow{box-shadow:0 1px 3px rgba(0,0,0,.1)}.shadow-md{box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}.shadow-lg{box-shadow:0 10px 15px -3px rgba(0,0,0,.1)}.shadow-xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.1)}
.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}
.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}.font-mono{font-family:ui-monospace,monospace}.text-center{text-align:center}
.bg-white{background-color:#fff}.bg-slate-50{background-color:#f8fafc}.bg-slate-100{background-color:#f1f5f9}.bg-slate-800{background-color:#1e293b}.bg-slate-900{background-color:#0f172a}.bg-slate-950{background-color:#020617}
.bg-sky-500{background-color:#0ea5e9}.bg-sky-600{background-color:#0284c7}.bg-blue-600{background-color:#2563eb}.bg-emerald-500{background-color:#10b981}.bg-emerald-600{background-color:#059669}.bg-rose-500{background-color:#f43f5e}.bg-amber-500{background-color:#f59e0b}
.text-white{color:#fff}.text-slate-900{color:#0f172a}.text-slate-700{color:#334155}.text-slate-600{color:#475569}.text-slate-500{color:#64748b}.text-slate-400{color:#94a3b8}.text-slate-300{color:#cbd5e1}.text-slate-100{color:#f1f5f9}.text-sky-500{color:#0ea5e9}.text-sky-400{color:#38bdf8}.text-emerald-500{color:#10b981}.text-rose-500{color:#f43f5e}
.cursor-pointer{cursor:pointer}.transition{transition:all .15s ease}.hover\\:opacity-90:hover{opacity:.9}
`;

// Offline runtime Tailwind JIT generator: converts dynamic utility classes (colors, gradients, grids, responsive, hover, arbitrary values) into CSS rules
export const TAILWIND_RUNTIME_SHIM = String.raw`<script data-codelab-tw-jit="true">(()=>{
  if (window.__codelabTwInit) return;
  window.__codelabTwInit = true;
  const COLORS = {
    white:'#ffffff',black:'#000000',transparent:'transparent',current:'currentColor',
    slate:{50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617'},
    gray:{50:'#f9fafb',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',800:'#1f2937',900:'#111827',950:'#030712'},
    zinc:{50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b'},
    red:{50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d',950:'#450a0a'},
    rose:{50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337',950:'#4c0519'},
    orange:{50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12',950:'#431407'},
    amber:{50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03'},
    yellow:{50:'#fefce8',100:'#fef9c3',200:'#fef08a',300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04',700:'#a16207',800:'#854d0e',900:'#713f12',950:'#422006'},
    lime:{50:'#f7fee7',100:'#ecfccb',200:'#d9f99d',300:'#bef264',400:'#a3e635',500:'#84cc16',600:'#65a30d',700:'#4d7c0f',800:'#3f6212',900:'#365314',950:'#1a2e05'},
    green:{50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d',950:'#052e16'},
    emerald:{50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b',950:'#022c22'},
    teal:{50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a',950:'#042f2e'},
    cyan:{50:'#ecfeff',100:'#cffafe',200:'#a5f3fc',300:'#67e8f9',400:'#22d3ee',500:'#06b6d4',600:'#0891b2',700:'#0e7490',800:'#155e75',900:'#164e63',950:'#083344'},
    sky:{50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e',950:'#082f49'},
    blue:{50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554'},
    indigo:{50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81',950:'#1e1b4b'},
    violet:{50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065'},
    purple:{50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87',950:'#3b0764'},
    fuchsia:{50:'#fdf4ff',100:'#fae8ff',200:'#f5d0fe',300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',800:'#86198f',900:'#701a75',950:'#4a044e'},
    pink:{50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843',950:'#500724'},
  };
  const MAX_W = {xs:'20rem',sm:'24rem',md:'28rem',lg:'32rem',xl:'36rem','2xl':'42rem','3xl':'48rem','4xl':'56rem','5xl':'64rem','6xl':'72rem','7xl':'80rem',full:'100%',screen:'100vw',none:'none',prose:'65ch'};
  const RADIUS = {none:'0px',sm:'0.125rem','':'0.25rem',md:'0.375rem',lg:'0.5rem',xl:'0.75rem','2xl':'1rem','3xl':'1.5rem',full:'9999px'};
  const TEXT_SIZE = {xs:['0.75rem','1rem'],sm:['0.875rem','1.25rem'],base:['1rem','1.5rem'],lg:['1.125rem','1.75rem'],xl:['1.25rem','1.75rem'],'2xl':['1.5rem','2rem'],'3xl':['1.875rem','2.25rem'],'4xl':['2.25rem','2.5rem'],'5xl':['3rem','1'],'6xl':['3.75rem','1'],'7xl':['4.5rem','1']};
  const FONT_W = {thin:100,extralight:200,light:300,normal:400,medium:500,semibold:600,bold:700,extrabold:800,black:900};
  const SHADOWS = {sm:'0 1px 2px 0 rgba(0,0,0,.05)','':'0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1)',md:'0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)',lg:'0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)',xl:'0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)','2xl':'0 25px 50px -12px rgba(0,0,0,.25)',none:'none'};
  const BP = {sm:'640px',md:'768px',lg:'1024px',xl:'1280px','2xl':'1536px'};

  function resolveColor(tok) {
    if (!tok) return null;
    let alpha = null;
    let base = tok;
    const slashIdx = tok.lastIndexOf('/');
    if (slashIdx > 0) {
      base = tok.slice(0, slashIdx);
      const op = tok.slice(slashIdx + 1);
      if (op.startsWith('[') && op.endsWith(']')) alpha = parseFloat(op.slice(1, -1));
      else if (/^\d+$/.test(op)) alpha = Number(op) / 100;
    }
    let hex = null;
    if (base.startsWith('[') && base.endsWith(']')) hex = base.slice(1, -1);
    else if (typeof COLORS[base] === 'string') hex = COLORS[base];
    else {
      const m = base.match(/^([a-z]+)-(\d{2,3})$/);
      if (m && COLORS[m[1]] && COLORS[m[1]][m[2]]) hex = COLORS[m[1]][m[2]];
    }
    if (!hex) return null;
    if (alpha !== null && /^#[0-9a-f]{6}$/i.test(hex)) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }
    return hex;
  }

  function resolveLen(v) {
    if (v === '0') return '0px';
    if (v === 'px') return '1px';
    if (v === 'auto') return 'auto';
    if (v === 'full') return '100%';
    if (v === 'screen') return '100vh';
    if (v === 'fit') return 'fit-content';
    if (v && v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).replace(/_/g, ' ');
    if (v && /^\d+\/\d+$/.test(v)) {
      const [a, b] = v.split('/').map(Number);
      return ((a / b) * 100).toFixed(4).replace(/\.?0+$/, '') + '%';
    }
    if (v && /^(?:\d+|\d*\.\d+)$/.test(v)) return (Number(v) * 0.25) + 'rem';
    return null;
  }

  function ruleDecls(u) {
    let neg = false;
    if (u.startsWith('-')) { neg = true; u = u.slice(1); }
    const sign = neg ? '-' : '';
    const staticMap = {
      block:'display:block',inline:'display:inline','inline-block':'display:inline-block',
      flex:'display:flex','inline-flex':'display:inline-flex',grid:'display:grid','inline-grid':'display:inline-grid',hidden:'display:none',
      relative:'position:relative',absolute:'position:absolute',fixed:'position:fixed',sticky:'position:sticky',static:'position:static',
      'flex-col':'flex-direction:column','flex-row':'flex-direction:row','flex-wrap':'flex-wrap:wrap','flex-nowrap':'flex-wrap:nowrap',
      'flex-1':'flex:1 1 0%','flex-auto':'flex:1 1 auto','flex-none':'flex:none','shrink-0':'flex-shrink:0',grow:'flex-grow:1','grow-0':'flex-grow:0',
      'items-start':'align-items:flex-start','items-center':'align-items:center','items-end':'align-items:flex-end','items-stretch':'align-items:stretch','items-baseline':'align-items:baseline',
      'justify-start':'justify-content:flex-start','justify-center':'justify-content:center','justify-end':'justify-content:flex-end','justify-between':'justify-content:space-between','justify-around':'justify-content:space-around',
      'place-items-center':'place-items:center','content-center':'align-content:center',
      'text-left':'text-align:left','text-center':'text-align:center','text-right':'text-align:right','text-justify':'text-align:justify',
      'italic':'font-style:italic','not-italic':'font-style:normal','uppercase':'text-transform:uppercase','lowercase':'text-transform:lowercase','capitalize':'text-transform:capitalize',
      underline:'text-decoration-line:underline','line-through':'text-decoration-line:line-through','no-underline':'text-decoration-line:none',
      truncate:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap','whitespace-nowrap':'white-space:nowrap',
      'overflow-hidden':'overflow:hidden','overflow-auto':'overflow:auto','overflow-x-auto':'overflow-x:auto','overflow-y-auto':'overflow-y:auto',
      'cursor-pointer':'cursor:pointer','cursor-not-allowed':'cursor:not-allowed','select-none':'user-select:none','pointer-events-none':'pointer-events:none',
      'w-screen':'width:100vw','h-screen':'height:100vh','min-h-screen':'min-height:100vh','min-w-0':'min-width:0',
      'object-cover':'object-fit:cover','object-contain':'object-fit:contain',
      'aspect-square':'aspect-ratio:1/1','aspect-video':'aspect-ratio:16/9',
      transition:'transition-property:color,background-color,border-color,opacity,box-shadow,transform;transition-duration:150ms',
      'transition-all':'transition-property:all;transition-duration:150ms',
      'transition-colors':'transition-property:color,background-color,border-color;transition-duration:150ms',
      'transition-transform':'transition-property:transform;transition-duration:150ms',
      'bg-gradient-to-r':'background-image:linear-gradient(to right,var(--tw-from,transparent),var(--tw-via,var(--tw-to,transparent)),var(--tw-to,transparent))',
      'bg-gradient-to-l':'background-image:linear-gradient(to left,var(--tw-from,transparent),var(--tw-via,var(--tw-to,transparent)),var(--tw-to,transparent))',
      'bg-gradient-to-b':'background-image:linear-gradient(to bottom,var(--tw-from,transparent),var(--tw-via,var(--tw-to,transparent)),var(--tw-to,transparent))',
      'bg-gradient-to-t':'background-image:linear-gradient(to top,var(--tw-from,transparent),var(--tw-via,var(--tw-to,transparent)),var(--tw-to,transparent))',
      'bg-gradient-to-br':'background-image:linear-gradient(to bottom right,var(--tw-from,transparent),var(--tw-to,transparent))',
      'bg-gradient-to-tr':'background-image:linear-gradient(to top right,var(--tw-from,transparent),var(--tw-to,transparent))',
      'backdrop-blur-sm':'backdrop-filter:blur(4px)','backdrop-blur':'backdrop-filter:blur(8px)','backdrop-blur-md':'backdrop-filter:blur(12px)','backdrop-blur-lg':'backdrop-filter:blur(16px)',
      'antialiased':'-webkit-font-smoothing:antialiased',
    };
    if (staticMap[u]) return staticMap[u];
    let m;
    if ((m = u.match(/^grid-cols-(\d+)$/))) return 'grid-template-columns:repeat(' + m[1] + ',minmax(0,1fr))';
    if ((m = u.match(/^col-span-(\d+)$/))) return 'grid-column:span ' + m[1] + ' / span ' + m[1];
    if ((m = u.match(/^duration-(\d+)$/))) return 'transition-duration:' + m[1] + 'ms';
    if ((m = u.match(/^opacity-(\d+)$/))) return 'opacity:' + (Number(m[1]) / 100);
    if ((m = u.match(/^z-(\d+|auto)$/))) return 'z-index:' + m[1];
    if ((m = u.match(/^scale-(\d+)$/))) return 'transform:scale(' + (Number(m[1]) / 100) + ')';
    if ((m = u.match(/^translate-y-(.+)$/))) { const l = resolveLen(m[1]); return l ? 'transform:translateY(' + sign + l + ')' : null; }
    if ((m = u.match(/^translate-x-(.+)$/))) { const l = resolveLen(m[1]); return l ? 'transform:translateX(' + sign + l + ')' : null; }
    if ((m = u.match(/^rotate-(\d+)$/))) return 'transform:rotate(' + sign + m[1] + 'deg)';
    if ((m = u.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/))) return 'font-weight:' + FONT_W[m[1]];
    if (u === 'font-mono') return 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace';
    if (u === 'font-sans') return 'font-family:system-ui,-apple-system,sans-serif';
    if ((m = u.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/))) return 'font-size:' + TEXT_SIZE[m[1]][0] + ';line-height:' + TEXT_SIZE[m[1]][1];
    if ((m = u.match(/^tracking-(tighter|tight|normal|wide|wider|widest)$/))) {
      const tr = {tighter:'-0.05em',tight:'-0.025em',normal:'0em',wide:'0.025em',wider:'0.05em',widest:'0.1em'};
      return 'letter-spacing:' + tr[m[1]];
    }
    if ((m = u.match(/^leading-(none|tight|snug|normal|relaxed|loose|\d+)$/))) {
      const ld = {none:'1',tight:'1.25',snug:'1.375',normal:'1.5',relaxed:'1.625',loose:'2'};
      return 'line-height:' + (ld[m[1]] || (Number(m[1]) * 0.25 + 'rem'));
    }
    if ((m = u.match(/^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/))) return 'border-radius:' + RADIUS[m[1] || ''];
    if ((m = u.match(/^shadow(?:-(sm|md|lg|xl|2xl|none))?$/))) return 'box-shadow:' + SHADOWS[m[1] || ''];
    if (u === 'border') return 'border-width:1px;border-style:solid';
    if ((m = u.match(/^border-(0|2|4|8)$/))) return 'border-width:' + m[1] + 'px;border-style:solid';
    if ((m = u.match(/^border-([trbl])(?:-(0|2|4|8))?$/))) {
      const dir = {t:'top',r:'right',b:'bottom',l:'left'}[m[1]];
      return 'border-' + dir + '-width:' + (m[2] || '1') + 'px;border-' + dir + '-style:solid';
    }
    if (u === 'ring' || (m = u.match(/^ring-([1248])$/))) {
      const w = m ? m[1] : '3';
      return 'box-shadow:0 0 0 ' + w + 'px var(--tw-ring-color,rgba(59,130,246,0.5))';
    }
    if ((m = u.match(/^ring-(.+)$/))) { const c = resolveColor(m[1]); return c ? '--tw-ring-color:' + c : null; }
    if ((m = u.match(/^(bg|text|border)-(.+)$/))) {
      const c = resolveColor(m[2]);
      if (c) {
        if (m[1] === 'bg') return 'background-color:' + c;
        if (m[1] === 'text') return 'color:' + c;
        return 'border-color:' + c;
      }
    }
    if ((m = u.match(/^(from|via|to)-(.+)$/))) {
      const c = resolveColor(m[2]);
      return c ? '--tw-' + m[1] + ':' + c : null;
    }
    if ((m = u.match(/^max-w-(.+)$/))) return MAX_W[m[1]] ? 'max-width:' + MAX_W[m[1]] : (resolveLen(m[1]) ? 'max-width:' + resolveLen(m[1]) : null);
    if ((m = u.match(/^(w|h|min-w|min-h|max-h|size)-(.+)$/))) {
      const l = resolveLen(m[2]);
      if (!l) return null;
      const p = {w:'width',h:'height','min-w':'min-width','min-h':'min-height','max-h':'max-height'}[m[1]];
      if (m[1] === 'size') return 'width:' + l + ';height:' + l;
      return p + ':' + l;
    }
    if ((m = u.match(/^(inset|top|right|bottom|left)-(.+)$/))) {
      const l = resolveLen(m[2]);
      return l ? m[1] + ':' + sign + l : null;
    }
    if ((m = u.match(/^gap-(?:(x|y)-)?(.+)$/))) {
      const l = resolveLen(m[2]);
      if (!l) return null;
      return m[1] === 'x' ? 'column-gap:' + l : m[1] === 'y' ? 'row-gap:' + l : 'gap:' + l;
    }
    if ((m = u.match(/^(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me)-(.+)$/))) {
      const l = resolveLen(m[2]);
      if (!l) return null;
      const v = sign + l;
      const kind = m[1][0] === 'p' ? 'padding' : 'margin';
      const dir = m[1].slice(1);
      if (!dir) return kind + ':' + v;
      if (dir === 'x') return kind + '-left:' + v + ';' + kind + '-right:' + v;
      if (dir === 'y') return kind + '-top:' + v + ';' + kind + '-bottom:' + v;
      const dmap = {t:'top',r:'right',b:'bottom',l:'left',s:'inline-start',e:'inline-end'};
      return kind + '-' + dmap[dir] + ':' + v;
    }
    if ((m = u.match(/^space-(x|y)-(.+)$/))) {
      const l = resolveLen(m[2]);
      return l ? { childRule: true, decl: (m[1] === 'x' ? 'margin-inline-start:' : 'margin-top:') + sign + l } : null;
    }
    return null;
  }

  const seen = new Set();
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-codelab-tw-jit', 'true');
  document.head.appendChild(styleEl);

  function compileClass(cls) {
    if (!cls || seen.has(cls)) return '';
    seen.add(cls);
    const parts = cls.split(':');
    const utility = parts.pop();
    const res = ruleDecls(utility);
    if (!res) return '';
    const esc = CSS && CSS.escape ? CSS.escape(cls) : cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    let sel = '.' + esc;
    let isChild = false;
    let decl = res;
    if (typeof res === 'object' && res.childRule) {
      isChild = true;
      decl = res.decl;
      sel += ' > * + *';
    }
    let bp = null;
    let pseudo = '';
    for (const p of parts) {
      if (BP[p]) bp = BP[p];
      else if (p === 'hover' || p === 'focus' || p === 'active' || p === 'disabled') pseudo += ':' + p;
    }
    if (pseudo && !isChild) sel += pseudo;
    const rule = sel + '{' + decl + '}';
    return bp ? '@media (min-width:' + bp + '){' + rule + '}' : rule;
  }

  function scan() {
    let batch = '';
    const els = document.querySelectorAll('[class]');
    for (let i = 0; i < els.length; i++) {
      const list = els[i].classList;
      for (let j = 0; j < list.length; j++) {
        batch += compileClass(list[j]);
      }
    }
    if (batch) styleEl.appendChild(document.createTextNode(batch));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }
})();<` + `/script>`;


// Basic SCSS/Tailwind CSS preprocessing (strips @tailwind directives, // comments, resolves simple $variables)
export function preprocessCss(code = '', path = '') {
  let out = String(code || '')
    .replace(/^\s*@tailwind\s+[^;]+;\s*$/gim, '')
    .replace(/^\s*@import\s+["']tailwindcss(?:\/[^"']*)?["']\s*;?\s*$/gim, '');
  if (!/\.(scss|sass)$/i.test(path)) return out;
  const vars = {};
  out = out.replace(/\/\/.*$/gm, '');
  out = out.replace(/^\s*(\$[\w-]+)\s*:\s*([^;]+);/gm, (_, name, val) => {
    vars[name] = val.trim();
    return '';
  });
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(k.replace('$', '\\$') + '\\b', 'g');
    out = out.replace(re, v);
  }
  return out;
}

export function detectJsxOrReact(code = '', path = '') {
  if (/\.(jsx|tsx)$/i.test(path)) return true;
  if (/import\s+[^;]*\bfrom\s+['"]react(?:-dom(?:\/client)?)?['"]/i.test(code)) return true;
  if (/React\.createElement|createRoot\s*\(|ReactDOM\.render\s*\(/.test(code)) return true;
  if (/export\s+default\s+(?:function\s+[A-Z]\w*|\([^)]*\)\s*=>)|function\s+(?:App|Page|Home|Main|RootLayout)\s*\(/.test(code) && /return\s*\(?\s*</.test(code)) {
    return true;
  }
  return false;
}

export function detectTailwindUsage(files = {}) {
  for (const [path, entry] of Object.entries(files)) {
    if (typeof entry !== 'string' || isNonAppWorkspaceFile(path)) continue;
    if (isStyleFile(path) && /@tailwind\b|@import\s+["']tailwindcss["']/i.test(entry)) return true;
    if (
      (isHtmlFile(path) || isScriptFile(path)) &&
      /(?:class|className)\s*=\s*["'][^"']*\b(?:flex|grid|bg-|text-|p-|px-|py-|m-|mx-|my-|rounded|shadow|border|gap-|w-|h-)/i.test(entry)
    ) {
      return true;
    }
  }
  return false;
}

const PREFERRED_SCRIPT_ENTRIES = [
  'src/main.tsx',
  'src/main.jsx',
  'src/main.ts',
  'src/main.js',
  'src/index.tsx',
  'src/index.jsx',
  'src/index.ts',
  'src/index.js',
  'src/App.tsx',
  'src/App.jsx',
  'src/App.ts',
  'src/App.js',
  'app/page.tsx',
  'app/page.jsx',
  'app/page.js',
  'main.tsx',
  'main.jsx',
  'main.ts',
  'main.js',
  'App.tsx',
  'App.jsx',
  'App.ts',
  'App.js',
  'app.tsx',
  'app.jsx',
  'app.ts',
  'app.js',
  'index.tsx',
  'index.jsx',
  'index.ts',
  'index.js',
];

function isSupportingScript(path = '', files = {}) {
  if (!path) return false;
  if (/^(?:src\/|app\/)?(?:components?|lib|utils?|helpers?|hooks?|context|services?|store|types?|styles?|data)\//i.test(path)) {
    return true;
  }
  if (/^(?:src\/|app\/)?layout\.(?:tsx|jsx|ts|js)$/i.test(path)) return true;

  // Check if another workspace script explicitly imports this file
  for (const [otherPath, otherCode] of Object.entries(files)) {
    if (otherPath === path || typeof otherCode !== 'string' || !isScriptFile(otherPath)) continue;
    const importRe = /(?:from\s+|import\s+|require\s*\(\s*|import\s*\(\s*)(['"])([^'"]+)\1/g;
    let m;
    while ((m = importRe.exec(otherCode)) !== null) {
      if (resolveModulePath(m[2], otherPath, files) === path) {
        return true;
      }
    }
  }

  // If file has no side-effect execution (no createRoot, ReactDOM.render, document., window., console.), treat as supporting module
  const code = files[path] || '';
  const hasSideEffects = /(?:createRoot\s*\(|ReactDOM\.render\s*\(|document\.|window\.|console\.)/.test(code);
  const exportsDefaultComponent = /export\s+default\s+/.test(code) && detectJsxOrReact(code, path);
  if (!hasSideEffects && !exportsDefaultComponent) return true;

  return false;
}

export function pickScriptEntry(files = {}, activeFile = '') {
  let preferredEntry = '';
  for (const candidate of PREFERRED_SCRIPT_ENTRIES) {
    if (typeof files[candidate] === 'string') {
      preferredEntry = candidate;
      break;
    }
  }
  if (!preferredEntry) {
    preferredEntry =
      Object.keys(files).find((k) => /\.(tsx|jsx)$/i.test(k) && typeof files[k] === 'string' && !isNonAppWorkspaceFile(k) && !/layout\./i.test(k)) ||
      Object.keys(files).find((k) => isScriptFile(k) && typeof files[k] === 'string' && !isNonAppWorkspaceFile(k) && !isSupportingScript(k, files)) ||
      Object.keys(files).find((k) => isScriptFile(k) && typeof files[k] === 'string' && !isNonAppWorkspaceFile(k)) ||
      Object.keys(files).find((k) => isScriptFile(k) && typeof files[k] === 'string') ||
      '';
  }

  if (activeFile && isScriptFile(activeFile) && typeof files[activeFile] === 'string' && !isNonAppWorkspaceFile(activeFile)) {
    if (PREFERRED_SCRIPT_ENTRIES.includes(activeFile)) {
      return activeFile;
    }
    if (preferredEntry && preferredEntry !== activeFile && isSupportingScript(activeFile, files)) {
      return preferredEntry;
    }
    return activeFile;
  }

  return preferredEntry;
}

export function resolveModulePath(specifier, fromPath, files = {}) {
  if (!specifier || typeof specifier !== 'string') return null;
  if (/^(https?:|data:|blob:)/i.test(specifier)) return null;

  let basePath = specifier;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const dirParts = String(fromPath || '').split('/').slice(0, -1);
    const relParts = specifier.split('/');
    for (const seg of relParts) {
      if (!seg || seg === '.') continue;
      if (seg === '..') dirParts.pop();
      else dirParts.push(seg);
    }
    basePath = dirParts.join('/');
  } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    basePath = specifier.slice(2);
  } else if (specifier.startsWith('/')) {
    basePath = specifier.slice(1);
  } else {
    return null; // bare package specifier (react, lucide-react, etc.)
  }

  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json', '.css', '.scss', '.svg'];
  const candidates = [];
  for (const ext of exts) {
    candidates.push(basePath + ext);
    if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
      candidates.push('src/' + basePath + ext);
    }
  }
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    candidates.push(basePath + '/index' + ext);
    if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
      candidates.push('src/' + basePath + '/index' + ext);
    }
  }

  for (const c of candidates) {
    if (files[c] !== undefined) return c;
  }
  return null;
}

export function transpileModuleCode(code, filePath = 'index.js') {
  try {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'js';
    const transforms = ['imports'];
    if (ext === 'ts' || ext === 'tsx') transforms.push('typescript');
    if (ext === 'jsx' || ext === 'tsx' || ext === 'js' || ext === 'mjs') {
      if (ext === 'jsx' || ext === 'tsx' || /<[A-Za-z>]/.test(code)) {
        transforms.push('jsx');
      }
    }
    return transform(code, {
      transforms,
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    }).code;
  } catch (err) {
    const msg = err?.message || 'Syntax error';
    return `throw new SyntaxError(${JSON.stringify(`${filePath}: ${msg}`)});`;
  }
}

// Synchronous, 100% offline-capable React 18 compatible runtime for JSX/TSX preview inside iframe
export const MINI_REACT_RUNTIME = `<script>(()=>{
  if (window.React && window.ReactDOM) return;
  const Fragment = Symbol.for('codelab.fragment');
  let hookIdx = 0;
  let currentInst = null;
  let rootContainer = null;
  let rootVNode = null;
  const instances = new WeakMap();
  let renderScheduled = false;

  function createElement(type, props, ...children) {
    const flat = [];
    const pushChild = (c) => {
      if (Array.isArray(c)) c.forEach(pushChild);
      else if (c !== null && c !== undefined && typeof c !== 'boolean') flat.push(c);
    };
    children.forEach(pushChild);
    const finalProps = props ? Object.assign({}, props) : {};
    if (flat.length === 1) finalProps.children = flat[0];
    else if (flat.length > 1) finalProps.children = flat;
    return { $$typeof: Symbol.for('codelab.element'), type, props: finalProps, key: finalProps.key ?? null };
  }

  function normalizeChildren(c) {
    if (c === null || c === undefined || typeof c === 'boolean') return [];
    if (Array.isArray(c)) return c.flatMap(normalizeChildren);
    return [c];
  }

  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(partial) {
      const next = typeof partial === 'function' ? partial(this.state, this.props) : partial;
      this.state = Object.assign({}, this.state, next);
      scheduleRerender();
    }
    render() { return null; }
  }

  function createContext(defaultValue) {
    const ctx = { _current: defaultValue, Provider: ({ value, children }) => { ctx._current = value; return createElement(Fragment, null, children); }, Consumer: ({ children }) => typeof children === 'function' ? children(ctx._current) : null };
    return ctx;
  }

  function getHookSlot() {
    if (!currentInst) return {};
    const i = hookIdx++;
    if (!currentInst.hooks[i]) currentInst.hooks[i] = {};
    return currentInst.hooks[i];
  }

  function depsChanged(prev, next) {
    if (!prev || !next) return true;
    if (prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      if (!Object.is(prev[i], next[i])) return true;
    }
    return false;
  }

  function useState(init) {
    const slot = getHookSlot();
    if (!slot.init) {
      slot.val = typeof init === 'function' ? init() : init;
      slot.init = true;
      slot.set = (next) => {
        const computed = typeof next === 'function' ? next(slot.val) : next;
        if (!Object.is(slot.val, computed)) {
          slot.val = computed;
          scheduleRerender();
        }
      };
    }
    return [slot.val, slot.set];
  }

  function useReducer(reducer, initArg, initFn) {
    const slot = getHookSlot();
    if (!slot.init) {
      slot.val = initFn ? initFn(initArg) : initArg;
      slot.init = true;
      slot.dispatch = (action) => {
        const next = reducer(slot.val, action);
        if (!Object.is(slot.val, next)) {
          slot.val = next;
          scheduleRerender();
        }
      };
    }
    return [slot.val, slot.dispatch];
  }

  function useRef(init) {
    const slot = getHookSlot();
    if (!slot.init) { slot.ref = { current: init }; slot.init = true; }
    return slot.ref;
  }

  function useMemo(fn, deps) {
    const slot = getHookSlot();
    if (!slot.init || depsChanged(slot.deps, deps)) {
      slot.val = fn();
      slot.deps = deps;
      slot.init = true;
    }
    return slot.val;
  }

  function useCallback(fn, deps) {
    return useMemo(() => fn, deps);
  }

  function useEffect(fn, deps) {
    const slot = getHookSlot();
    if (!slot.init || depsChanged(slot.deps, deps)) {
      slot.deps = deps;
      slot.init = true;
      pendingEffects.push(() => {
        if (typeof slot.cleanup === 'function') { try { slot.cleanup(); } catch {} }
        const res = fn();
        slot.cleanup = typeof res === 'function' ? res : null;
      });
    }
  }

  function useContext(ctx) {
    return ctx ? ctx._current : undefined;
  }

  const pendingEffects = [];
  const hookStore = new Map();
  const classStore = new Map();

  function getInst(key) {
    if (!hookStore.has(key)) hookStore.set(key, { hooks: [] });
    return hookStore.get(key);
  }

  const SVG_TAGS = new Set(['svg','path','circle','rect','line','polygon','polyline','ellipse','g','defs','linearGradient','stop','text']);
  const UNITLESS = new Set(['opacity','zIndex','fontWeight','lineHeight','flex','flexGrow','flexShrink','order','zoom','scale','columnCount','fillOpacity','strokeOpacity','strokeWidth']);

  function setProp(el, k, v) {
    if (k === 'children' || k === 'key') return;
    if (k === 'ref' && v && typeof v === 'object') { v.current = el; return; }
    if (k === 'ref' && typeof v === 'function') { v(el); return; }
    if (k === 'dangerouslySetInnerHTML' && v && v.__html != null) { el.innerHTML = v.__html; return; }
    if (k === 'className') { el.setAttribute('class', v || ''); return; }
    if (k === 'htmlFor') { el.setAttribute('for', v || ''); return; }
    if (k === 'style' && v && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sv == null) continue;
        if (sk.startsWith('--')) el.style.setProperty(sk, String(sv));
        else el.style[sk] = typeof sv === 'number' && !UNITLESS.has(sk) ? sv + 'px' : String(sv);
      }
      return;
    }
    if (/^on[A-Z]/.test(k) && typeof v === 'function') {
      const ev = k.slice(2).toLowerCase();
      el.addEventListener(ev === 'doubleclick' ? 'dblclick' : ev, v);
      if (ev === 'change' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.addEventListener('input', v);
      }
      return;
    }
    if (typeof v === 'boolean') {
      if (v) el.setAttribute(k, '');
      if (k in el) el[k] = v;
      return;
    }
    if (v != null) {
      if (k === 'defaultValue' && 'value' in el) el.value = String(v);
      else if (k === 'defaultChecked' && 'checked' in el) el.checked = Boolean(v);
      else if (k === 'value' && 'value' in el) el.value = String(v);
      else el.setAttribute(k, String(v));
    }
  }

  function renderNode(vnode, pathKey = '0', inSvg = false) {
    if (vnode === null || vnode === undefined || typeof vnode === 'boolean') {
      return document.createDocumentFragment();
    }
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode));
    }
    if (Array.isArray(vnode)) {
      const frag = document.createDocumentFragment();
      vnode.forEach((child, idx) => frag.appendChild(renderNode(child, pathKey + '.' + idx, inSvg)));
      return frag;
    }
    if (vnode.type === Fragment) {
      const frag = document.createDocumentFragment();
      normalizeChildren(vnode.props?.children).forEach((child, idx) => frag.appendChild(renderNode(child, pathKey + '.f' + idx, inSvg)));
      return frag;
    }
    if (typeof vnode.type === 'function') {
      if (vnode.type.prototype && vnode.type.prototype.isReactComponent) {
        const clsKey = pathKey + ':' + (vnode.type.name || 'cls');
        let inst = classStore.get(clsKey);
        if (!inst || !(inst instanceof vnode.type)) {
          inst = new vnode.type(vnode.props || {});
          const origSetState = inst.setState?.bind(inst);
          inst.setState = (partial) => {
            const next = typeof partial === 'function' ? partial(inst.state || {}, inst.props || {}) : partial;
            inst.state = Object.assign({}, inst.state || {}, next || {});
            scheduleRerender();
            if (origSetState && origSetState !== inst.setState) {
              try { origSetState(partial); } catch {}
            }
          };
          classStore.set(clsKey, inst);
        } else {
          inst.props = vnode.props || {};
        }
        return renderNode(inst.render(), pathKey + '.c', inSvg);
      }
      const prevInst = currentInst;
      const prevIdx = hookIdx;
      currentInst = getInst(pathKey + ':' + (vnode.type.name || 'fn'));
      hookIdx = 0;
      let out = null;
      try {
        out = vnode.type(vnode.props || {});
      } finally {
        currentInst = prevInst;
        hookIdx = prevIdx;
      }
      return renderNode(out, pathKey + '.0', inSvg);
    }
    const props = vnode.props || {};
    if (vnode.type === 'head' || vnode.type === 'meta' || vnode.type === 'link') {
      return document.createDocumentFragment();
    }
    if (vnode.type === 'title') {
      const text = normalizeChildren(props.children).map((c) => typeof c === 'string' || typeof c === 'number' ? String(c) : '').join('');
      if (text) document.title = text;
      return document.createDocumentFragment();
    }
    if (vnode.type === 'html' || vnode.type === 'body') {
      if (vnode.type === 'html') {
        if (props.lang) document.documentElement.lang = props.lang;
        if (props.dir) document.documentElement.dir = props.dir;
      }
      if (vnode.type === 'body' && props.className) {
        document.body.className = props.className;
      }
      const wrapper = document.createElement('div');
      wrapper.setAttribute(vnode.type === 'html' ? 'data-codelab-html' : 'data-codelab-body', 'true');
      if (props.className) wrapper.setAttribute('class', props.className);
      if (props.style) setProp(wrapper, 'style', props.style);
      normalizeChildren(props.children).forEach((child, idx) => wrapper.appendChild(renderNode(child, pathKey + '.' + idx, inSvg)));
      return wrapper;
    }
    const isSvg = inSvg || vnode.type === 'svg' || SVG_TAGS.has(vnode.type);
    const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', vnode.type) : document.createElement(vnode.type);
    for (const [k, v] of Object.entries(props)) setProp(el, k, v);
    if (!props.dangerouslySetInnerHTML) {
      normalizeChildren(props.children).forEach((child, idx) => el.appendChild(renderNode(child, pathKey + '.' + idx, isSvg)));
    }
    if ((vnode.type === 'select' || vnode.type === 'textarea') && props.value !== undefined) {
      el.value = String(props.value);
    }
    return el;
  }

  function commitRender() {
    if (!rootContainer || rootVNode === undefined) return;
    pendingEffects.length = 0;
    const active = document.activeElement;
    const activeId = active && active.id ? active.id : null;
    const activeInputIdx = !activeId && active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && rootContainer.contains(active)
      ? Array.from(rootContainer.querySelectorAll('input,textarea,select')).indexOf(active)
      : -1;
    const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    try {
      const dom = renderNode(rootVNode, 'root', false);
      rootContainer.innerHTML = '';
      rootContainer.appendChild(dom);
      const focusTarget = activeId
        ? document.getElementById(activeId)
        : activeInputIdx >= 0
          ? rootContainer.querySelectorAll('input,textarea,select')[activeInputIdx]
          : null;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
        if (selStart !== null && typeof focusTarget.setSelectionRange === 'function') {
          try { focusTarget.setSelectionRange(selStart, selStart); } catch {}
        }
      }
      const effects = pendingEffects.splice(0);
      setTimeout(() => effects.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }), 0);
    } catch (err) {
      console.error(err);
      rootContainer.innerHTML = '<div style="padding:16px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font-family:monospace;font-size:13px;"><strong>Render Error:</strong> ' + String(err && err.message ? err.message : err) + '</div>';
    }
  }

  function scheduleRerender() {
    if (renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      commitRender();
    });
  }

  Component.prototype.isReactComponent = true;

  const React = {
    version: '18.3.1-codelab',
    Fragment,
    Component,
    PureComponent: Component,
    createElement,
    jsx: (type, props, key) => createElement(type, key !== undefined ? Object.assign({}, props, { key }) : props),
    jsxs: (type, props, key) => createElement(type, key !== undefined ? Object.assign({}, props, { key }) : props),
    jsxDEV: (type, props, key) => createElement(type, key !== undefined ? Object.assign({}, props, { key }) : props),
    cloneElement: (el, props, ...children) => createElement(el.type, Object.assign({}, el.props, props), ...(children.length ? children : [el.props?.children])),
    isValidElement: (el) => Boolean(el && typeof el === 'object' && el.$$typeof === Symbol.for('codelab.element')),
    createContext,
    useState,
    useReducer,
    useRef,
    useMemo,
    useCallback,
    useEffect,
    useLayoutEffect: useEffect,
    useContext,
    memo: (c) => c,
    forwardRef: (fn) => (props) => fn(props, props?.ref || null),
    StrictMode: Fragment,
    Suspense: ({ children }) => createElement(Fragment, null, children),
    Children: {
      map: (c, fn) => normalizeChildren(c).map(fn),
      forEach: (c, fn) => normalizeChildren(c).forEach(fn),
      toArray: (c) => normalizeChildren(c),
      count: (c) => normalizeChildren(c).length,
    },
  };

  const ReactDOM = {
    render(vnode, container) {
      window.__codelabMounted = true;
      rootContainer = container;
      rootVNode = vnode;
      commitRender();
    },
    createRoot(container) {
      return {
        render(vnode) {
          window.__codelabMounted = true;
          rootContainer = container;
          rootVNode = vnode;
          commitRender();
        },
        unmount() {
          window.__codelabMounted = false;
          if (container) container.innerHTML = '';
        },
      };
    },
  };

  window.React = React;
  window.ReactDOM = ReactDOM;
  window.__codelabReactLoaded = true;
})();<\/script>`;

// Smart runtime observer: if <body> has no visible elements after scripts execute, render live console/status preview and auto-dismiss on DOM mutations
export function buildEmptyBodyObserver(activeFile = '', locale = 'ar') {
  const isEn = locale === 'en';
  const labels = {
    file: activeFile || 'index.html',
    consoleTitle: isEn ? 'Live Execution Output' : 'مخرجات التشغيل الحية',
    readyTitle: isEn ? 'Live Preview Active' : 'المعاينة الحية نشطة',
    readyDesc: isEn
      ? 'This document currently has no visible elements inside <body>. Any DOM updates or console output will appear here automatically.'
      : 'لا يحتوي وسم <body> في هذا الملف على عناصر مرئية حالياً. أي عناصر أو مخرجات يتم إنشاؤها برمجياً ستظهر هنا تلقائياً.',
    stylesActive: isEn ? 'CSS styles loaded' : 'تنسيقات CSS نشطة',
  };

  return `<script>(()=>{
  const LABELS = ${escapeInlineScript(JSON.stringify(labels))};
  const FALLBACK_ID = 'codelab-empty-preview-fallback';

  function hasVisibleContent() {
    const body = document.body;
    if (!body) return false;
    const IGNORED = new Set(['SCRIPT','STYLE','LINK','META','TITLE','NOSCRIPT','TEMPLATE']);
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.closest && parent.closest('#' + FALLBACK_ID)) continue;
        if (IGNORED.has(parent.tagName)) continue;
        if (node.nodeValue && node.nodeValue.trim().length > 0) return true;
      } else if (node.nodeType === 1) {
        if (node.id === FALLBACK_ID || (node.closest && node.closest('#' + FALLBACK_ID))) continue;
        if (IGNORED.has(node.tagName)) continue;
        if (['IMG','SVG','CANVAS','VIDEO','AUDIO','IFRAME','INPUT','BUTTON','TEXTAREA','SELECT','HR'].includes(node.tagName)) {
          return true;
        }
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        if (rect && rect.width > 0 && rect.height > 0) {
          const cs = window.getComputedStyle ? window.getComputedStyle(node) : null;
          if (!cs || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function renderFallback() {
    if (!document.body) return;
    if (hasVisibleContent()) {
      const existing = document.getElementById(FALLBACK_ID);
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById(FALLBACK_ID)) return;

    const logs = Array.isArray(window.__codelabLogs) ? window.__codelabLogs : [];
    const wrap = document.createElement('div');
    wrap.id = FALLBACK_ID;
    wrap.setAttribute('style', 'position:fixed;inset:0;overflow:auto;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#e2e8f0;');

    const card = document.createElement('div');
    card.setAttribute('style', 'width:100%;max-width:560px;background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.22);border-radius:12px;padding:20px;box-shadow:0 12px 32px rgba(0,0,0,0.35);');

    const header = document.createElement('div');
    header.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,0.16);');
    const title = document.createElement('div');
    title.setAttribute('style', 'font-weight:700;font-size:14px;color:#38bdf8;');
    title.textContent = logs.length ? LABELS.consoleTitle : LABELS.readyTitle;

    const badge = document.createElement('span');
    badge.setAttribute('style', 'font-family:ui-monospace,monospace;font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(56,189,248,0.14);color:#7dd3fc;');
    badge.textContent = LABELS.file;
    header.appendChild(title);
    header.appendChild(badge);
    card.appendChild(header);

    if (logs.length) {
      const pre = document.createElement('pre');
      pre.setAttribute('dir', 'ltr');
      pre.setAttribute('style', 'margin:0;padding:12px;border-radius:8px;background:#020617;border:1px solid rgba(51,65,85,0.7);font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.6;overflow:auto;max-height:60vh;white-space:pre-wrap;word-break:break-word;');
      logs.forEach((entry) => {
        const line = document.createElement('div');
        const col = entry.level === 'error' ? '#f87171' : entry.level === 'warn' ? '#fbbf24' : entry.level === 'info' ? '#60a5fa' : '#4ade80';
        line.setAttribute('style', 'color:' + col + ';padding:2px 0;');
        line.textContent = (entry.level === 'error' ? '✖ ' : entry.level === 'warn' ? '⚠ ' : '› ') + entry.m;
        pre.appendChild(line);
      });
      card.appendChild(pre);
    } else {
      const p = document.createElement('p');
      p.setAttribute('style', 'margin:0;font-size:13px;line-height:1.65;color:#cbd5e1;');
      p.textContent = LABELS.readyDesc;
      card.appendChild(p);
      if (document.styleSheets && document.styleSheets.length > 0) {
        const pill = document.createElement('div');
        pill.setAttribute('style', 'margin-top:12px;display:inline-block;font-size:11px;padding:4px 10px;border-radius:6px;background:rgba(16,185,129,0.14);color:#6ee7b7;border:1px solid rgba(16,185,129,0.28);');
        pill.textContent = '✓ ' + LABELS.stylesActive + ' (' + document.styleSheets.length + ')';
        card.appendChild(pill);
      }
    }

    wrap.appendChild(card);
    document.body.appendChild(wrap);
  }

  function scheduleCheck() {
    requestAnimationFrame(() => setTimeout(renderFallback, 120));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleCheck);
  } else {
    scheduleCheck();
  }

  if (typeof MutationObserver !== 'undefined') {
    const startObs = () => {
      if (!document.body) return;
      const obs = new MutationObserver((mutations) => {
        const externalMutation = mutations.some((m) => {
          const target = m.target;
          if (target && target.id === FALLBACK_ID) return false;
          if (target && target.closest && target.closest('#' + FALLBACK_ID)) return false;
          for (const n of m.addedNodes || []) {
            if (n.id === FALLBACK_ID) return false;
          }
          return true;
        });
        if (externalMutation && hasVisibleContent()) {
          const existing = document.getElementById(FALLBACK_ID);
          if (existing) existing.remove();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) startObs();
    else document.addEventListener('DOMContentLoaded', startObs);
  }
})();<\/script>`;
}

export function transpileClassicScript(code, filePath = 'script.js') {
  try {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'js';
    const transforms = [];
    if (ext === 'ts' || ext === 'tsx') transforms.push('typescript');
    if (ext === 'jsx' || ext === 'tsx' || (/<[A-Za-z>]/.test(code) && detectJsxOrReact(code, filePath))) {
      transforms.push('jsx');
    }
    if (transforms.length === 0) return code;
    return transform(code, {
      transforms,
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    }).code;
  } catch (err) {
    const msg = err?.message || 'Syntax error';
    return `console.error(${JSON.stringify(`${filePath}: ${msg}`)});`;
  }
}

// Compile workspace script modules starting from entryPath into an inline CommonJS bundle script + optional global sibling scripts
export function compileWorkspaceBundle(
  files = {},
  entryPath = '',
  resolveMediaUrl = () => null,
  resolveCssUrls = (s) => s,
  options = {}
) {
  const visited = new Set();
  const modules = {};
  const extraCss = [];

  // Detect Next.js App Router layout wrapper when previewing app/page.*
  let nextLayoutPath = '';
  if (/^app\/page\.(?:tsx|jsx|ts|js)$/i.test(entryPath)) {
    nextLayoutPath =
      ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'app/layout.ts'].find(
        (p) => typeof files[p] === 'string'
      ) || '';
  }

  function visit(path) {
    if (!path || visited.has(path)) return;
    visited.add(path);
    const entry = files[path];
    if (typeof entry !== 'string') {
      if (isMediaEntry(entry)) {
        modules[path] = `module.exports = ${JSON.stringify(entry.dataUrl)};`;
      }
      return;
    }
    if (isStyleFile(path)) {
      extraCss.push(`/* ${path} */\n${resolveCssUrls(preprocessCss(entry, path))}`);
      if (/\.module\.(css|scss|sass|less)$/i.test(path)) {
        const classMap = {};
        const clsRe = /\.([a-zA-Z_-][\w-]*)/g;
        let cm;
        while ((cm = clsRe.exec(entry)) !== null) {
          classMap[cm[1]] = cm[1];
        }
        modules[path] = `const __cls = ${JSON.stringify(classMap)}; module.exports = typeof Proxy !== 'undefined' ? new Proxy(__cls, { get(t, k) { if (k === '__esModule') return true; if (k === 'default') return module.exports; return typeof k === 'string' ? (t[k] || k) : t[k]; } }) : __cls;`;
      } else {
        modules[path] = 'module.exports = {};';
      }
      return;
    }
    if (/\.json$/i.test(path)) {
      modules[path] = `module.exports = ${entry || 'null'};`;
      return;
    }
    if (/\.svg$/i.test(path)) {
      const url = resolveMediaUrl(path) || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(entry)}`;
      modules[path] = `module.exports = ${JSON.stringify(url)};`;
      return;
    }

    const importRe = /(?:from\s+|import\s+|require\s*\(\s*|import\s*\(\s*)(['"])([^'"]+)\1/g;
    let match;
    while ((match = importRe.exec(entry)) !== null) {
      const resolved = resolveModulePath(match[2], path, files);
      if (resolved) visit(resolved);
    }

    modules[path] = transpileModuleCode(entry, path);
  }

  visit(entryPath);
  if (nextLayoutPath) visit(nextLayoutPath);

  const resolutionMap = {};
  for (const fromPath of visited) {
    const src = files[fromPath];
    if (typeof src !== 'string') continue;
    const importRe = /(?:from\s+|import\s+|require\s*\(\s*|import\s*\(\s*)(['"])([^'"]+)\1/g;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      const resolved = resolveModulePath(m[2], fromPath, files);
      if (resolved) {
        resolutionMap[`${fromPath}::${m[2]}`] = resolved;
      }
    }
  }

  // Sibling global scripts (without import/export) when linking a multi-file workspace without HTML
  const siblingGlobals = [];
  if (options.includeSiblingGlobals !== false) {
    for (const [path, content] of Object.entries(files)) {
      if (visited.has(path) || typeof content !== 'string' || !isScriptFile(path)) continue;
      if (isNonAppWorkspaceFile(path)) continue;
      const usesModuleSyntax = /^\s*(?:import|export)\s+/m.test(content) || /\brequire\s*\(/.test(content);
      if (!usesModuleSyntax) {
        siblingGlobals.push({ path, code: transpileClassicScript(content, path) });
      }
    }
  }

  const preludeScript = siblingGlobals
    .map(({ path, code }) => `<script data-file="${escapeHtml(path)}">\n${escapeInlineScript(code)}\n<\/script>`)
    .join('\n');

  const entrySource = typeof files[entryPath] === 'string' ? files[entryPath] : '';
  const entryHasJsx = detectJsxOrReact(entrySource, entryPath);

  const virtualFetchAssets = {};
  for (const [p, v] of Object.entries(files)) {
    if (typeof v === 'string' && /\.(json|txt|csv|md|svg)$/i.test(p) && !isNonAppWorkspaceFile(p)) {
      virtualFetchAssets[p] = v;
    }
  }

  const runtimeScript = `<script>(()=>{
  const process = window.process || { env: { NODE_ENV: 'development' } };
  const VIRTUAL_ASSETS = ${escapeInlineScript(JSON.stringify(virtualFetchAssets))};
  if (typeof window.fetch === 'function' && Object.keys(VIRTUAL_ASSETS).length) {
    const origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (urlStr && !/^(https?:|data:|blob:)/i.test(urlStr)) {
        const clean = urlStr.split('?')[0].split('#')[0].replace(/^\\.\\//, '').replace(/^\\//, '');
        const match = VIRTUAL_ASSETS[clean] !== undefined ? clean : Object.keys(VIRTUAL_ASSETS).find((k) => k === clean || k.endsWith('/' + clean));
        if (match) {
          const body = VIRTUAL_ASSETS[match];
          const ct = /\\.json$/i.test(match) ? 'application/json' : /\\.svg$/i.test(match) ? 'image/svg+xml' : 'text/plain';
          return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': ct } }));
        }
      }
      return origFetch(input, init);
    };
  }
  const MODULES = {
${Object.entries(modules)
  .map(([p, code]) => `    ${JSON.stringify(p)}: function(module, exports, require, __filename) {\n${escapeInlineScript(code)}\n    }`)
  .join(',\n')}
  };
  const RES_MAP = ${escapeInlineScript(JSON.stringify(resolutionMap))};
  const CACHE = {};
  const ENTRY = ${JSON.stringify(entryPath)};
  const LAYOUT_ENTRY = ${JSON.stringify(nextLayoutPath)};
  const ENTRY_HAS_JSX = ${JSON.stringify(entryHasJsx)};

  const ICON_PATHS = {
    Home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
    Search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
    User: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    Settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09c-.66 0-1.25.4-1.51 1z'],
    Check: ['M20 6L9 17l-5-5'],
    CheckCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
    X: ['M18 6L6 18', 'M6 6l12 12'],
    Plus: ['M12 5v14', 'M5 12h14'],
    Minus: ['M5 12h14'],
    Trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    Trash2: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
    ArrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
    ArrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
    ChevronRight: ['M9 18l6-6-6-6'],
    ChevronLeft: ['M15 18l-6-6 6-6'],
    ChevronDown: ['M6 9l6 6 6-6'],
    Sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
    Moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    Star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    Heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
    Mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
    Bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
    Code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
    Play: ['M5 3l14 9-14 9V3z'],
    Terminal: ['M4 17l6-6-6-6', 'M12 19h8'],
    Menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
    Globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
    ShoppingCart: ['M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'],
    Sparkles: ['M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z', 'M5 19l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z'],
    Zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    Lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
    Copy: ['M9 9h13v13H9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    ExternalLink: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3'],
  };

  function makeStubIcon(name) {
    return function IconStub(props) {
      const React = window.React;
      const size = (props && props.size) || 16;
      const cls = (props && props.className) || '';
      const paths = ICON_PATHS[name];
      const children = paths
        ? paths.map((d, idx) => React.createElement('path', { key: idx, d }))
        : [React.createElement('rect', { key: 0, x: 4, y: 4, width: 16, height: 16, rx: 4 })];
      return React.createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        className: cls, 'aria-label': name,
      }, ...children);
    };
  }

  function makeMotionProxy() {
    const STRIP = new Set(['initial','animate','exit','transition','variants','whileHover','whileTap','whileInView','viewport','layout','layoutId']);
    return new Proxy({}, {
      get: (_, tag) => function MotionEl(props) {
        const React = window.React;
        const clean = {};
        if (props) {
          for (const [k, v] of Object.entries(props)) {
            if (!STRIP.has(k)) clean[k] = v;
          }
        }
        return React.createElement(String(tag), clean);
      },
    });
  }

  function makeRequire(fromPath) {
    return function require(spec) {
      if (spec === 'react' || spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') return window.React;
      if (spec === 'react-dom' || spec === 'react-dom/client') return window.ReactDOM;
      if (spec === 'motion/react' || spec === 'framer-motion') {
        const React = window.React;
        return {
          __esModule: true,
          motion: makeMotionProxy(),
          AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
        };
      }
      if (spec === 'next/link') {
        const React = window.React;
        return { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', Object.assign({ href: href || '#' }, rest), children) };
      }
      if (spec === 'next/image') {
        const React = window.React;
        return { __esModule: true, default: ({ src, alt, fill, priority, unoptimized, ...rest }) => React.createElement('img', Object.assign({ src: src || '', alt: alt || '' }, rest)) };
      }
      if (spec === 'next/head') {
        const React = window.React;
        return { __esModule: true, default: ({ children }) => React.createElement(React.Fragment, null, children) };
      }
      if (spec === 'next/navigation' || spec === 'next/router') {
        const router = { push: () => {}, replace: () => {}, back: () => {}, refresh: () => {}, pathname: '/' };
        return { useRouter: () => router, usePathname: () => '/', useSearchParams: () => new URLSearchParams(), useParams: () => ({}) };
      }
      if (spec === 'lucide-react') {
        return new Proxy({}, { get: (_, prop) => makeStubIcon(String(prop)) });
      }
      if (spec === 'clsx' || spec === 'classnames') {
        const fn = (...args) => args.flat(Infinity).filter(Boolean).join(' ');
        return Object.assign(fn, { __esModule: true, default: fn, clsx: fn });
      }
      if (spec === 'tailwind-merge') {
        const twMerge = (...args) => args.filter(Boolean).join(' ');
        return { twMerge };
      }

      const target = RES_MAP[fromPath + '::' + spec] || (MODULES[spec] ? spec : null);
      if (!target || !MODULES[target]) {
        console.warn('Module not bundled:', spec);
        return {};
      }
      if (CACHE[target]) return CACHE[target].exports;
      const mod = { exports: {} };
      CACHE[target] = mod;
      MODULES[target](mod, mod.exports, makeRequire(target), target);
      return mod.exports;
    };
  }

  try {
    const req = makeRequire(ENTRY);
    const exp = req(ENTRY);
    const rootEl = document.getElementById('root') || document.getElementById('app');
    const namedPascal = exp && typeof exp === 'object'
      ? Object.values(exp).find((v) => typeof v === 'function' && /^[A-Z]/.test(v.name || ''))
      : null;
    const candidate = exp && (exp.default || exp.App || exp.Page || exp.Home || exp.Main || (typeof exp === 'function' ? exp : namedPascal));
    const looksLikeComponent =
      candidate &&
      window.React &&
      window.ReactDOM &&
      (window.React.isValidElement(candidate) ||
        (typeof candidate === 'function' &&
          (candidate.prototype?.isReactComponent ||
            ENTRY_HAS_JSX ||
            /\\.(jsx|tsx)$/i.test(ENTRY) ||
            /^[A-Z]/.test(candidate.name || ''))));
    if (!window.__codelabMounted && rootEl && rootEl.childNodes.length === 0 && looksLikeComponent) {
      let el = typeof candidate === 'function' ? window.React.createElement(candidate, null) : candidate;
      if (LAYOUT_ENTRY && MODULES[LAYOUT_ENTRY]) {
        const layoutMod = req(LAYOUT_ENTRY);
        const LayoutComp = layoutMod && (layoutMod.default || layoutMod.RootLayout);
        if (typeof LayoutComp === 'function') {
          el = window.React.createElement(LayoutComp, null, el);
        }
      }
      if (window.React.isValidElement(el)) {
        window.ReactDOM.createRoot(rootEl).render(el);
      }
    }
  } catch (err) {
    console.error(err);
  }
})();<\/script>`;

  return { runtimeScript, preludeScript, extraCss: extraCss.join('\n'), bundledPaths: visited };
}
