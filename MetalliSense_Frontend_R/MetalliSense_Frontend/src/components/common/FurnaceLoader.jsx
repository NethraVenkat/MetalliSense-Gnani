import React, { useId } from "react";
import clsx from "clsx";

/**
 * Molten-metal loading indicators (pure SVG, no assets).
 *
 *  <CrucibleIcon />   small 3D crucible with a boiling, glowing melt — for buttons / inline
 *  <FurnaceLoader />  3D foundry scene: tilting ladle pours a glowing stream into an
 *                     ingot mould, sparks spray, embers rise, heat haze glows.
 *
 * Animations: CSS keyframes in index.css (ms-*) + SVG turbulence for the boiling
 * surface. CSS motion is disabled under prefers-reduced-motion.
 */

const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, "");

function MoltenDefs({ id }) {
  return (
    <>
      {/* molten metal colour ramps */}
      <radialGradient id={`melt-${id}`} cx="0.45" cy="0.4" r="0.7">
        <stop offset="0%" stopColor="#fffbe6" />
        <stop offset="25%" stopColor="#ffe066" />
        <stop offset="55%" stopColor="#ff9f1a" />
        <stop offset="85%" stopColor="#ff4d00" />
        <stop offset="100%" stopColor="#b3200a" />
      </radialGradient>
      <linearGradient id={`stream-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ff5a00" />
        <stop offset="35%" stopColor="#ffd23f" />
        <stop offset="50%" stopColor="#fffbe6" />
        <stop offset="65%" stopColor="#ffd23f" />
        <stop offset="100%" stopColor="#ff5a00" />
      </linearGradient>
      {/* brushed / refractory steel shell */}
      <linearGradient id={`shell-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#141a21" />
        <stop offset="18%" stopColor="#3b4654" />
        <stop offset="32%" stopColor="#8b99a8" />
        <stop offset="40%" stopColor="#4a5664" />
        <stop offset="75%" stopColor="#262e38" />
        <stop offset="92%" stopColor="#5a3a22" />
        <stop offset="100%" stopColor="#1a1410" />
      </linearGradient>
      <linearGradient id={`lip-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#2b2420" />
        <stop offset="35%" stopColor="#8a6a55" />
        <stop offset="60%" stopColor="#c4552a" />
        <stop offset="100%" stopColor="#3a2418" />
      </linearGradient>
      <linearGradient id={`mould-front-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4a5563" />
        <stop offset="100%" stopColor="#161c23" />
      </linearGradient>
      <linearGradient id={`mould-side-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#262e38" />
        <stop offset="100%" stopColor="#0e1318" />
      </linearGradient>
      <linearGradient id={`mould-top-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6b7887" />
        <stop offset="100%" stopColor="#2d3742" />
      </linearGradient>
      <radialGradient id={`haze-${id}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ff8a1f" stopOpacity="0.75" />
        <stop offset="45%" stopColor="#ff5a00" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#ff5a00" stopOpacity="0" />
      </radialGradient>

      {/* soft bloom around anything hot */}
      <filter id={`glow-${id}`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.6" result="b1" />
        <feGaussianBlur stdDeviation="7" result="b2" />
        <feMerge>
          <feMergeNode in="b2" />
          <feMergeNode in="b1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* boiling surface: animated turbulence -> bright crust streaks + wobble */}
      <filter id={`boil-${id}`} x="-10%" y="-30%" width="120%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09 0.28" numOctaves="3" seed="7" result="noise">
          <animate attributeName="seed" values="7;8;9;10;11;12;7" dur="1.4s" repeatCount="indefinite" calcMode="discrete" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" result="wobble" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.8  0 0 0 -2.4 1.45" result="hot" />
        <feComposite in="hot" in2="wobble" operator="in" result="hotIn" />
        <feMerge>
          <feMergeNode in="wobble" />
          <feMergeNode in="hotIn" />
        </feMerge>
      </filter>
      <filter id={`ripple-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="turbulence" baseFrequency="0.02 0.18" numOctaves="2" result="n">
          <animate attributeName="baseFrequency" values="0.02 0.18;0.03 0.24;0.02 0.18" dur="0.9s" repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" />
      </filter>
      <filter id={`smoke-${id}`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </>
  );
}

export function CrucibleIcon({ size = 18, className }) {
  const id = useUid();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={clsx("shrink-0 overflow-visible", className)} aria-hidden>
      <defs><MoltenDefs id={id} /></defs>
      <circle className="ms-flicker" cx="16" cy="12" r="11" fill={`url(#haze-${id})`} />
      {/* embers */}
      <circle className="ms-ember" cx="12" cy="10" r="1" fill="#ffd23f" style={{ "--rx": "-3px", animationDelay: "0ms" }} />
      <circle className="ms-ember" cx="17" cy="9" r="0.9" fill="#ff8a1f" style={{ "--rx": "2px", animationDelay: "400ms" }} />
      <circle className="ms-ember" cx="20" cy="10.5" r="0.8" fill="#fff1a8" style={{ "--rx": "4px", animationDelay: "800ms" }} />
      {/* 3D crucible body */}
      <path d="M5 12.5 L8 26 Q16 30 24 26 L27 12.5 Z" fill={`url(#shell-${id})`} />
      <path d="M6.3 18 Q16 21.5 25.7 18" fill="none" stroke="#0e1318" strokeOpacity=".6" strokeWidth=".8" />
      {/* lip + boiling melt */}
      <ellipse cx="16" cy="12.5" rx="11.2" ry="3.4" fill={`url(#lip-${id})`} />
      <g filter={`url(#glow-${id})`}>
        <ellipse cx="16" cy="12.6" rx="9.3" ry="2.5" fill={`url(#melt-${id})`} filter={`url(#boil-${id})`} className="ms-flicker" />
      </g>
    </svg>
  );
}

const SPARKS = [
  // dx, rise, delay, radius, colour
  [-34, 22, 0, 1.6, "#fff1a8"], [-22, 30, 180, 1.2, "#ffd23f"], [-12, 36, 420, 1.4, "#ff9f1a"],
  [10, 34, 90, 1.3, "#fff1a8"], [22, 28, 300, 1.7, "#ffd23f"], [34, 20, 520, 1.2, "#ff8a1f"],
  [-28, 16, 640, 1.1, "#ffd23f"], [28, 14, 760, 1.1, "#fff1a8"], [-6, 40, 860, 1.0, "#ffe066"],
  [4, 26, 980, 1.5, "#ff9f1a"], [40, 24, 1100, 1.0, "#ffd23f"], [-40, 26, 1200, 1.0, "#ff8a1f"],
];

export default function FurnaceLoader({ label = "Melting the numbers…", sublabel, size = 220, className, compact = false }) {
  const id = useUid();
  const scene = (
    <svg width={size} height={size * 0.78} viewBox="0 0 240 188" aria-hidden className="overflow-visible">
      <defs><MoltenDefs id={id} /></defs>

      {/* floor + reflected heat */}
      <ellipse cx="146" cy="174" rx="70" ry="7" fill="#1a2129" opacity=".18" />
      <ellipse className="ms-flicker" cx="146" cy="172" rx="70" ry="14" fill={`url(#haze-${id})`} />
      <circle className="ms-flicker" cx="146" cy="138" r="62" fill={`url(#haze-${id})`} opacity=".7" />

      {/* smoke from the mould */}
      {[0, 900, 1800].map((d, i) => (
        <circle key={i} className="ms-smoke" cx={150 + i * 8} cy="134" r="9" fill="#9eafc0" filter={`url(#smoke-${id})`} style={{ animationDelay: `${d}ms` }} />
      ))}

      {/* ── ingot mould (3D box) ── */}
      <polygon points="96,146 186,146 186,170 96,170" fill={`url(#mould-front-${id})`} />
      <polygon points="186,146 204,132 204,156 186,170" fill={`url(#mould-side-${id})`} />
      <polygon points="96,146 186,146 204,132 114,132" fill={`url(#mould-top-${id})`} />
      <line x1="96" y1="146" x2="186" y2="146" stroke="#9eafc0" strokeOpacity=".55" strokeWidth="1" />
      <line x1="186" y1="146" x2="204" y2="132" stroke="#9eafc0" strokeOpacity=".35" strokeWidth="1" />
      {/* cavity + molten fill */}
      <polygon points="106,143 180,143 194,134 120,134" fill="#07090c" />
      <g filter={`url(#glow-${id})`}>
        <polygon className="ms-fill" points="108,142.3 178.5,142.3 191.5,134.7 121.5,134.7" fill={`url(#melt-${id})`} filter={`url(#boil-${id})`} />
      </g>
      {/* impact ripple */}
      <ellipse className="ms-ripple" cx="150" cy="138.5" rx="10" ry="2.6" fill="none" stroke="#fffbe6" strokeWidth="1.4" />

      {/* ── pour stream ── */}
      <g filter={`url(#glow-${id})`}>
        <path d="M124,70 C 140,78 150,102 150,138" fill="none" stroke={`url(#stream-${id})`} strokeWidth="7" strokeLinecap="round" filter={`url(#ripple-${id})`} className="ms-stream-body" />
        <path className="ms-stream" d="M124,70 C 140,78 150,102 150,138" fill="none" stroke="#fffbe6" strokeWidth="2.2" strokeLinecap="round" />
        {/* molten blobs falling down the stream */}
        {[0, 0.18, 0.36, 0.54, 0.72].map((b, i) => (
          <ellipse key={i} rx={i % 2 ? 2.6 : 3.4} ry={i % 2 ? 3.4 : 4.4} fill={i % 2 ? "#ffd23f" : "#fffbe6"}>
            <animateMotion dur="0.9s" begin={`${-b}s`} repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.9 0.6"
              path="M124,70 C 140,78 150,102 150,138" />
          </ellipse>
        ))}
      </g>

      {/* splash sparks */}
      {SPARKS.map(([dx, rise, d, r, c], i) => (
        <circle key={i} className="ms-spark-arc" cx="150" cy="137" r={r} fill={c} filter={`url(#glow-${id})`}
          style={{ "--dx": `${dx}px`, "--rise": `${-rise}px`, animationDelay: `${d}ms` }} />
      ))}

      {/* ── ladle (3D cylinder), tilting about its trunnion ── */}
      <g className="ms-tilt" style={{ transformOrigin: "74px 72px" }}>
        {/* bail arm */}
        <path d="M36,72 C 30,30 118,30 112,72" fill="none" stroke="#1a2129" strokeWidth="5" strokeLinecap="round" />
        <path d="M36,72 C 30,30 118,30 112,72" fill="none" stroke="#6b7887" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
        {/* body */}
        <path d="M36,50 L44,104 Q74,116 104,104 L112,50 Z" fill={`url(#shell-${id})`} />
        {/* reinforcing bands */}
        <path d="M38.6,68 Q74,79 109.4,68" fill="none" stroke="#0e1318" strokeWidth="2.2" opacity=".8" />
        <path d="M38.6,68 Q74,79 109.4,68" fill="none" stroke="#8b99a8" strokeWidth=".6" opacity=".5" transform="translate(0,-1.4)" />
        <path d="M41.4,88 Q74,99 106.6,88" fill="none" stroke="#0e1318" strokeWidth="2.2" opacity=".8" />
        {/* heat-tint at the bottom */}
        <path d="M44,104 Q74,116 104,104 L102,96 Q74,107 46,96 Z" fill="#ff5a00" opacity=".18" />
        {/* trunnions */}
        <circle cx="36" cy="72" r="5" fill="#2d3742" stroke="#8b99a8" strokeWidth="1" />
        <circle cx="112" cy="72" r="5" fill="#1a2129" stroke="#4f5f73" strokeWidth="1" />
        {/* spout */}
        <path d="M108,46 L126,56 L110,56 Z" fill="#3a2418" />
        {/* refractory lip */}
        <ellipse cx="74" cy="50" rx="38" ry="10" fill={`url(#lip-${id})`} />
        <ellipse cx="74" cy="50" rx="38" ry="10" fill="none" stroke="#1a1410" strokeWidth="1" />
        {/* boiling melt surface */}
        <g filter={`url(#glow-${id})`}>
          <ellipse cx="74" cy="50.6" rx="32" ry="7.4" fill={`url(#melt-${id})`} filter={`url(#boil-${id})`} className="ms-flicker" />
          <path d="M108,49 L124,57" stroke={`url(#stream-${id})`} strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* specular highlight on shell */}
        <path d="M52,58 L56,100" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* embers rising off the ladle */}
      {[[62, 0, -6], [76, 500, 4], [88, 1000, 8], [70, 1500, -2]].map(([x, d, rx], i) => (
        <circle key={i} className="ms-ember-lg" cx={x} cy="40" r={i % 2 ? 1.2 : 1.6} fill={i % 2 ? "#ffd23f" : "#ff9f1a"}
          filter={`url(#glow-${id})`} style={{ "--rx": `${rx}px`, animationDelay: `${d}ms` }} />
      ))}
    </svg>
  );

  if (compact) return <span className={clsx("inline-flex", className)} role="status" aria-label={label}>{scene}</span>;

  return (
    <div className={clsx("flex flex-col items-center justify-center gap-2 py-6 text-center", className)} role="status" aria-live="polite">
      {scene}
      {label && <p className="text-sm font-bold tracking-wide text-metal-800">{label}</p>}
      {sublabel && <p className="text-xs text-metal-500">{sublabel}</p>}
      <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-metal-200">
        <div className="ms-progress h-full w-1/3 rounded-full bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600" />
      </div>
    </div>
  );
}

/** Compact molten-crucible spinner used on all pages except Grade Specs. */
export function MeltSpinner({ label, sublabel, size = 44, className }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-2 py-8 text-center", className)} role="status" aria-live="polite">
      <CrucibleIcon size={size} className="text-metal-700" />
      {label && <p className="text-sm font-semibold text-metal-700">{label}</p>}
      {sublabel && <p className="text-xs text-metal-500">{sublabel}</p>}
    </div>
  );
}
