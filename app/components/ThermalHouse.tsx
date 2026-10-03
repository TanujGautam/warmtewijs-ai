// A "thermal camera" view of a 1970s terraced house: where the heat leaks out.
// Pure SVG, no images; the hot spots pulse gently (disabled under reduced motion).
import s from "../landing.module.css";

export default function ThermalHouse({ lang = "en" }: { lang?: "en" | "nl" }) {
  const nl = lang === "nl";
  return (
    <svg className={s.thermal} viewBox="0 0 520 440" role="img" aria-labelledby="thermal-title thermal-desc">
      <title id="thermal-title">{nl ? "Warmtebeeld van een huis" : "Thermal image of a house"}</title>
      <desc id="thermal-desc">Infrared view showing heat escaping through the roof, the uninsulated cavity wall and single glazing.</desc>
      <defs>
        <radialGradient id="th-bg" cx="50%" cy="55%" r="75%">
          <stop offset="0" stopColor="#1b1f4a" />
          <stop offset="1" stopColor="#090a1a" />
        </radialGradient>
        <linearGradient id="th-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset=".45" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#e2366b" />
        </linearGradient>
        <linearGradient id="th-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c2306f" />
          <stop offset=".5" stopColor="#ff6a3d" />
          <stop offset="1" stopColor="#8a2a8f" />
        </linearGradient>
        <linearGradient id="th-cold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a8f" />
          <stop offset="1" stopColor="#1d2b7a" />
        </linearGradient>
        <radialGradient id="th-hot" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6b0" />
          <stop offset=".5" stopColor="#ffc23d" />
          <stop offset="1" stopColor="#ff6a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="th-scale" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#1d2b7a" />
          <stop offset=".35" stopColor="#8a2a8f" />
          <stop offset=".6" stopColor="#e2366b" />
          <stop offset=".8" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ffe066" />
        </linearGradient>
        <filter id="th-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="th-soft">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      <rect width="520" height="440" rx="18" fill="url(#th-bg)" />

      {/* neighbours (cold, insulated) */}
      <g opacity=".85" filter="url(#th-soft)">
        <path d="M18 210 L84 150 L150 210 V370 H18 Z" fill="url(#th-cold)" />
        <path d="M370 210 L436 150 L502 210 V370 H370 Z" fill="url(#th-cold)" />
      </g>

      {/* the house: glow underlay + body */}
      <g filter="url(#th-blur)" opacity=".75">
        <path d="M150 210 L260 112 L370 210 Z" fill="#ff8a3d" />
        <rect x="150" y="208" width="220" height="162" fill="#e2366b" />
      </g>
      <g filter="url(#th-soft)">
        <path d="M150 210 L260 112 L370 210 Z" fill="url(#th-roof)" />
        <rect x="150" y="208" width="220" height="162" fill="url(#th-wall)" />
        {/* windows = hottest: single glazing */}
        <rect x="172" y="232" width="62" height="50" rx="3" fill="#ffd25e" />
        <rect x="286" y="232" width="62" height="50" rx="3" fill="#ffd25e" />
        <rect x="172" y="300" width="62" height="50" rx="3" fill="#ffb347" />
        <rect x="246" y="296" width="30" height="74" rx="2" fill="#ff8a3d" />
        <rect x="290" y="300" width="58" height="50" rx="3" fill="#ffb347" />
        <rect x="150" y="364" width="220" height="10" fill="#8a2a8f" />
      </g>

      {/* hot spots */}
      <circle className={s.pulse} cx="260" cy="160" r="38" fill="url(#th-hot)" />
      <circle className={s.pulse} style={{ animationDelay: "1.2s" }} cx="203" cy="257" r="30" fill="url(#th-hot)" />
      <circle className={s.pulse} style={{ animationDelay: "2.1s" }} cx="317" cy="257" r="30" fill="url(#th-hot)" />

      {/* camera HUD */}
      <g fill="none" stroke="#ffffff" strokeOpacity=".55" strokeWidth="1.5">
        <path d="M30 30 h22 M30 30 v22 M490 30 h-22 M490 30 v22 M30 410 h22 M30 410 v-22 M490 410 h-22 M490 410 v-22" />
        <path d="M260 196 v16 M252 204 h16" />
      </g>
      <text x="40" y="66" fill="#fff" fillOpacity=".7" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="1">IR · 21:04 · 3511 AB</text>
      <text x="40" y="82" fill="#fff" fillOpacity=".45" fontFamily="var(--font-mono)" fontSize="10">{nl ? "buiten 2,4 °C" : "outside 2.4 °C"}</text>

      {/* temperature scale */}
      <rect x="474" y="96" width="10" height="200" rx="5" fill="url(#th-scale)" />
      <text x="466" y="102" textAnchor="end" fill="#fff" fillOpacity=".6" fontFamily="var(--font-mono)" fontSize="10">18°</text>
      <text x="466" y="296" textAnchor="end" fill="#fff" fillOpacity=".6" fontFamily="var(--font-mono)" fontSize="10">−2°</text>

      {/* callouts */}
      <g fontFamily="var(--font-mono)" fontSize="11" fill="#fff">
        <path d="M236 150 L176 128 H40" stroke="#fff" strokeOpacity=".6" fill="none" />
        <circle cx="236" cy="150" r="3" />
        <text x="40" y="122">{nl ? "DAK · 25% VERLIES" : "ROOF · 25% LOSS"}</text>
        <path d="M160 290 L120 252 H40" stroke="#fff" strokeOpacity=".6" fill="none" />
        <circle cx="160" cy="290" r="3" />
        <text x="40" y="246">{nl ? "LEGE SPOUWMUUR" : "EMPTY CAVITY WALL"}</text>
        <path d="M348 270 L420 330 H486" stroke="#fff" strokeOpacity=".6" fill="none" />
        <circle cx="348" cy="270" r="3" />
        <text x="404" y="324">{nl ? "ENKEL GLAS" : "SINGLE GLASS"}</text>
      </g>
    </svg>
  );
}
