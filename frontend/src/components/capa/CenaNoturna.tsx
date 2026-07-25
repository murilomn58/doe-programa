/**
 * Cena noturna da capa: céu navy, lua, estrelas, coluna de luz, 4 camadas de
 * ondas e o veleiro animado. Port fiel do design aprovado (tela "3a").
 * Presentational puro; as animações são CSS (capa.module.css).
 */

import styles from "./capa.module.css";

const ONDAS = [
  {
    classe: styles.camada1,
    fill: "#1B4E79",
    d: "M0,140 q120,-22 240,0 t240,0 t240,0 t240,0 t240,0 t240,0 t240,0 t240,0 t240,0 t240,0 t240,0 t240,0 L2880,400 L0,400 Z",
  },
  {
    classe: styles.camada2,
    fill: "#123A5E",
    d: "M0,140 q90,-30 180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 t180,0 L2880,400 L0,400 Z",
  },
  {
    classe: styles.camada3,
    fill: "#0A2A47",
    d: "M0,140 q60,-20 120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 L2880,400 L0,400 Z",
  },
  {
    classe: styles.camada4,
    fill: "#051B31",
    d: "M0,140 q45,-14 90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 t90,0 L2880,400 L0,400 Z",
  },
];

function Veleiro() {
  return (
    <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }}>
      <defs>
        <linearGradient id="capaVela1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EDF3FA" />
          <stop offset="100%" stopColor="#93AAC2" />
        </linearGradient>
        <linearGradient id="capaVela2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DEE9F3" />
          <stop offset="100%" stopColor="#7F97B0" />
        </linearGradient>
        <linearGradient id="capaCasco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16283E" />
          <stop offset="60%" stopColor="#0A1626" />
          <stop offset="100%" stopColor="#040A13" />
        </linearGradient>
      </defs>
      <line x1="44" y1="135" x2="10" y2="125" stroke="#0A1420" strokeWidth="3" strokeLinecap="round" />
      <line x1="170" y1="24" x2="246" y2="139" stroke="rgba(181,212,244,.35)" strokeWidth="1" />
      <line x1="170" y1="24" x2="104" y2="44" stroke="rgba(181,212,244,.35)" strokeWidth="1" />
      <rect x="168.6" y="22" width="3" height="116" fill="#0A1420" />
      <rect x="102.8" y="42" width="2.6" height="96" fill="#0A1420" />
      <path d="M103 48 C88 86 50 112 16 126 C60 121 88 125 102 132 Z" fill="url(#capaVela2)" />
      <path d="M167 32 C150 74 124 108 109 130 C131 125 152 127 166 132 Z" fill="url(#capaVela1)" opacity=".95" />
      <path d="M172 38 L216 26 C232 70 235 108 229 134 L172 134 C177 100 177 70 172 38 Z" fill="url(#capaVela1)" />
      <path d="M186 36 C192 72 193 104 190 134" stroke="#7E95AC" strokeWidth="1" fill="none" opacity=".55" />
      <path d="M202 32 C209 70 211 104 208 134" stroke="#7E95AC" strokeWidth="1" fill="none" opacity=".55" />
      <line x1="170" y1="37" x2="218" y2="25" stroke="#0A1420" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="169" y1="136" x2="238" y2="132" stroke="#0A1420" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M168 16 L188 21 L168 27 Z" fill="#B5D4F4" />
      <path d="M124 128 L164 128 Q166 128 166 131 L166 138 L120 138 L120 131 Q120 128 124 128 Z" fill="#101F33" />
      <circle cx="132" cy="133" r="1.8" fill="#F2E7CC" opacity=".95" />
      <circle cx="146" cy="133" r="1.8" fill="#F2E7CC" opacity=".95" />
      <path d="M36 138 C70 135 110 134 150 134 C190 134 228 135 252 138 C266 140 268 143 264 147 C250 158 226 164 186 166 C140 168 96 163 64 154 C48 149 38 144 36 138 Z" fill="url(#capaCasco)" />
      <path d="M40 139 C90 135 200 135 250 139" stroke="#3A5878" strokeWidth="1.4" fill="none" opacity=".8" />
      <circle cx="88" cy="148" r="2" fill="#F2E7CC" opacity=".8" />
      <circle cx="118" cy="150" r="2" fill="#F2E7CC" opacity=".8" />
      <circle cx="150" cy="151" r="2" fill="#F2E7CC" opacity=".8" />
      <circle cx="182" cy="150" r="2" fill="#F2E7CC" opacity=".7" />
      <path d="M30 146 Q60 152 92 154" stroke="#BFE4EC" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".45" />
      <path d="M196 162 Q240 158 268 148" stroke="#BFE4EC" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".35" />
    </svg>
  );
}

export function CenaNoturna() {
  return (
    <div className={styles.cena} aria-hidden>
      <div className={styles.ceu} />
      <div className={styles.lua} />
      <div className={styles.estrelas} />
      <div className={styles.oceano}>
        <div className={styles.luz} />
        {ONDAS.slice(0, 1).map((onda) => (
          <div key={onda.fill} className={`${styles.camada} ${onda.classe}`}>
            <svg viewBox="0 0 2880 400" preserveAspectRatio="none">
              <path d={onda.d} fill={onda.fill} />
            </svg>
          </div>
        ))}
        <div className={styles.barco}>
          <div className={styles.barcoInner}>
            <Veleiro />
          </div>
        </div>
        {ONDAS.slice(1).map((onda) => (
          <div key={onda.fill} className={`${styles.camada} ${onda.classe}`}>
            <svg viewBox="0 0 2880 400" preserveAspectRatio="none">
              <path d={onda.d} fill={onda.fill} />
            </svg>
          </div>
        ))}
      </div>
      <div className={styles.scrim} />
    </div>
  );
}
