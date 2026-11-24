'use client';

// Custom recognizable brand/logo SVG icons for all supported programming languages
export default function LanguageIcon({ lang, size = 18, className = '' }) {
  const s = size;

  switch (lang) {
    case 'html':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <path d="M3 2l1.6 18L12 22l7.4-2L21 2H3z" fill="#E34F26" />
          <path d="M12 3.6v16.7l5.9-1.6L19.2 3.6H12z" fill="#EF652A" />
          <path d="M12 10.2H8.4l-.2-2.4H12V5.5H5.8l.6 7H12v-2.3zm0 5.9l-2.6-.7-.2-2H6.9l.3 3.8 4.8 1.3v-2.4z" fill="#EBEBEB" />
          <path d="M12 10.2v2.3h2.9l-.3 2.9-2.6.7v2.4l4.8-1.3.6-7H12zm0-4.7v2.3h5.7l.2-2.3H12z" fill="#FFF" />
        </svg>
      );

    case 'css':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <path d="M3 2l1.6 18L12 22l7.4-2L21 2H3z" fill="#1572B6" />
          <path d="M12 3.6v16.7l5.9-1.6L19.2 3.6H12z" fill="#33A9DC" />
          <path d="M12 10.2H7.6l.2 2.2H12v-2.2zm0-4.7H6.2l.2 2.3H12V5.5zm0 10.6l-2.6-.7-.2-2H6.9l.3 3.8 4.8 1.3v-2.4z" fill="#EBEBEB" />
          <path d="M12 10.2v2.2h2.8l-.3 3-2.5.7v2.4l4.7-1.3.7-7H12zm0-4.7v2.3h5.6l.2-2.3H12z" fill="#FFF" />
        </svg>
      );

    case 'scss':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#CD6799" />
          <text x="12" y="15.5" textAnchor="middle" fill="#FFF" fontSize="8.5" fontWeight="800" fontFamily="monospace">
            Sass
          </text>
        </svg>
      );

    case 'js':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#F7DF1E" />
          <text x="14" y="18.5" textAnchor="middle" fill="#1E293B" fontSize="10.5" fontWeight="900" fontFamily="sans-serif">
            JS
          </text>
        </svg>
      );

    case 'ts':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#3178C6" />
          <text x="14" y="18.5" textAnchor="middle" fill="#FFFFFF" fontSize="10.5" fontWeight="900" fontFamily="sans-serif">
            TS
          </text>
        </svg>
      );

    case 'jsx':
    case 'tsx':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="4" fill={lang === 'tsx' ? '#1E3A8A' : '#0F172A'} />
          <circle cx="12" cy="12" r="2" fill="#38BDF8" />
          <ellipse cx="12" cy="12" rx="8" ry="3.2" fill="none" stroke="#38BDF8" strokeWidth="1.3" />
          <ellipse cx="12" cy="12" rx="8" ry="3.2" fill="none" stroke="#38BDF8" strokeWidth="1.3" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="8" ry="3.2" fill="none" stroke="#38BDF8" strokeWidth="1.3" transform="rotate(120 12 12)" />
        </svg>
      );

    case 'python':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <path
            d="M11.9 2C8.5 2 8.7 3.5 8.7 3.5V5.8h3.4v.8H6.3S3 6.2 3 9.9c0 3.7 2.9 3.6 2.9 3.6h1.7v-1.8s-.1-2.9 2.8-2.9h4.6s2.6 0 2.6-2.5V4.2S18 2 11.9 2zm-1.8 1.5a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4z"
            fill="#3776AB"
          />
          <path
            d="M12.1 22c3.4 0 3.2-1.5 3.2-1.5v-2.3h-3.4v-.8h5.8S21 17.8 21 14.1c0-3.7-2.9-3.6-2.9-3.6h-1.7v1.8s.1 2.9-2.8 2.9H9s-2.6 0-2.6 2.5v2.1S6 22 12.1 22zm1.8-1.5a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4z"
            fill="#FFD43B"
          />
        </svg>
      );

    case 'php':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <ellipse cx="12" cy="12" rx="10.5" ry="7.2" fill="#777BB4" stroke="#4F5B93" strokeWidth="1.2" />
          <text x="12" y="14.7" textAnchor="middle" fill="#FFFFFF" fontSize="8.2" fontWeight="900" fontStyle="italic" fontFamily="sans-serif">
            php
          </text>
        </svg>
      );

    case 'sql':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <ellipse cx="12" cy="6" rx="8" ry="3.2" fill="#F59E0B" />
          <path d="M4 6v12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6c0 1.8-3.6 3.2-8 3.2S4 7.8 4 6z" fill="#D97706" />
          <path d="M4 11.5c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" fill="none" stroke="#FDE68A" strokeWidth="1.1" />
          <text x="12" y="19.3" textAnchor="middle" fill="#FFFBEB" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">
            SQL
          </text>
        </svg>
      );

    case 'json':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#0F766E" />
          <text x="12" y="15.8" textAnchor="middle" fill="#CCFBF1" fontSize="11.5" fontWeight="800" fontFamily="monospace">
            {'{}'}
          </text>
        </svg>
      );

    case 'c':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#283593" />
          <text x="12" y="16" textAnchor="middle" fill="#FFFFFF" fontSize="11.5" fontWeight="900" fontFamily="sans-serif">
            C
          </text>
        </svg>
      );

    case 'cpp':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#00599C" />
          <text x="12" y="15.2" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="900" fontFamily="sans-serif">
            C++
          </text>
        </svg>
      );

    case 'csharp':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#68217A" />
          <text x="12" y="15.5" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900" fontFamily="sans-serif">
            C#
          </text>
        </svg>
      );

    case 'java':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <path d="M9 3c1.5 1.5-.5 3 1 4.5M13 2.5c1.5 1.5-.5 3 1 4.5" fill="none" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 10h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-5z" fill="#EA580C" />
          <path d="M16 11h1.8a2.2 2.2 0 0 1 0 4.4H16" fill="none" stroke="#EA580C" strokeWidth="1.8" />
          <path d="M4 21h14" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'kotlin':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <defs>
            <linearGradient id="ktGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7F52FF" />
              <stop offset="50%" stopColor="#C711E1" />
              <stop offset="100%" stopColor="#E44857" />
            </linearGradient>
          </defs>
          <polygon points="3,3 21,3 12,12 21,21 3,21" fill="url(#ktGrad)" />
        </svg>
      );

    case 'swift':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#F05138" />
          <path
            d="M17.5 15.6c.7-2-.2-4.6-2-6.6 1 2 .5 4-.7 5.2-2-1.5-4.3-3.5-6.1-5.6 1.3 2 3 4 4.8 5.4-1.8-.3-3.6-1.2-5-2.5 1.1 2 3.3 3.6 5.9 4.2-.9.6-2.1.8-3.4.5 1.8 1.1 4.4 1.2 6.5.2l1.2 1.1c.2-1-.2-1.8-1.2-1.9z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'go':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="5" fill="#00ADD8" />
          <text x="12" y="15.2" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900" fontStyle="italic" fontFamily="sans-serif">
            GO
          </text>
        </svg>
      );

    case 'rust':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="#1E293B" stroke="#F97316" strokeWidth="2.4" strokeDasharray="3 1.5" />
          <text x="12" y="15.5" textAnchor="middle" fill="#FDBA74" fontSize="10" fontWeight="900" fontFamily="serif">
            R
          </text>
        </svg>
      );

    case 'ruby':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <polygon points="7,4 17,4 21,9 12,20 3,9" fill="#DC2626" />
          <polygon points="7,4 17,4 15,9 9,9" fill="#FCA5A5" opacity="0.7" />
          <polygon points="9,9 15,9 12,20" fill="#991B1B" opacity="0.6" />
        </svg>
      );

    case 'dart':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <polygon points="6,6 15,3 21,9 21,17 15,17 6,15" fill="#0175C2" />
          <polygon points="3,9 6,6 15,15 15,21 9,21" fill="#13B9FD" />
        </svg>
      );

    case 'bash':
    case 'powershell':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="3" width="20" height="18" rx="4" fill={lang === 'powershell' ? '#1D4ED8' : '#1E293B'} />
          <path d="M6.5 9l3.5 3-3.5 3" fill="none" stroke={lang === 'powershell' ? '#93C5FD' : '#4ADE80'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="11.5" y1="15" x2="17" y2="15" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'lua':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#1E3A8A" />
          <circle cx="14.5" cy="9.5" r="2.2" fill="#FFFFFF" />
          <circle cx="19" cy="5" r="2" fill="#38BDF8" />
        </svg>
      );

    case 'r':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <ellipse cx="12" cy="12" rx="10" ry="7.5" fill="#CBD5E1" stroke="#276DC3" strokeWidth="1.5" />
          <text x="12.5" y="16" textAnchor="middle" fill="#1E40AF" fontSize="11.5" fontWeight="900" fontFamily="sans-serif">
            R
          </text>
        </svg>
      );

    case 'markdown':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="3" fill="#334155" />
          <path d="M5.5 15V9l2.5 3 2.5-3v6M16 9v5m-2-2l2 2.5 2-2.5" fill="none" stroke="#F8FAFC" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'dockerfile':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="3" width="20" height="18" rx="4" fill="#0DB7ED" />
          <rect x="5" y="8" width="3" height="3" fill="#FFF" />
          <rect x="9" y="8" width="3" height="3" fill="#FFF" />
          <rect x="13" y="8" width="3" height="3" fill="#FFF" />
          <rect x="9" y="4.5" width="3" height="3" fill="#FFF" />
          <path d="M4 13h16c-.5 3.5-3 5-7.5 5C7 18 4.5 16 4 13z" fill="#FFF" />
        </svg>
      );

    case 'xml':
    case 'svg':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="3" width="20" height="18" rx="4" fill={lang === 'svg' ? '#D97706' : '#EA580C'} />
          <text x="12" y="14.8" textAnchor="middle" fill="#FFF" fontSize="7.5" fontWeight="900" fontFamily="monospace">
            {lang === 'svg' ? 'SVG' : '</>'}
          </text>
        </svg>
      );

    case 'yaml':
    case 'toml':
    case 'nginx':
    case 'latex':
    case 'perl':
    case 'haskell':
    case 'scala':
    case 'erlang':
    case 'julia':
    case 'groovy':
    case 'clojure':
    case 'asm':
    case 'pascal':
    case 'fortran':
    default: {
      const badgeMap = {
        yaml: ['#E11D48', 'YML'],
        toml: ['#EA580C', 'TML'],
        nginx: ['#059669', 'NGX'],
        latex: ['#0D9488', 'TeX'],
        perl: ['#0284C7', 'PL'],
        haskell: ['#7C3AED', 'HS'],
        scala: ['#DC2626', 'SC'],
        erlang: ['#A21CAF', 'ERL'],
        julia: ['#16A34A', 'JL'],
        groovy: ['#0284C7', 'GRV'],
        clojure: ['#15803D', 'CLJ'],
        asm: ['#475569', 'ASM'],
        pascal: ['#D97706', 'PAS'],
        fortran: ['#4F46E5', 'F90'],
        text: ['#64748B', 'TXT'],
      };
      const [bg, text] = badgeMap[lang] || ['#475569', (lang || 'TXT').slice(0, 3).toUpperCase()];
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="3" width="20" height="18" rx="4" fill={bg} />
          <text x="12" y="15" textAnchor="middle" fill="#FFFFFF" fontSize={text.length > 2 ? '7.2' : '8.8'} fontWeight="800" fontFamily="monospace">
            {text}
          </text>
        </svg>
      );
    }
  }
}
