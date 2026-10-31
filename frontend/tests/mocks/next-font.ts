/**
 * Substituto de `next/font/google` fora do compilador do Next.
 *
 * Os imports do app sao NOMEADOS (`import { Spectral } from "next/font/google"`),
 * e import nomeado em ESM e resolvido estaticamente: um `export default` com
 * Proxy nao o satisfaz. Por isso cada fonte usada no projeto e declarada
 * explicitamente. O Proxy default fica como rede para acesso via namespace.
 */

const fonteFalsa = () => ({ className: "", variable: "", style: { fontFamily: "sans-serif" } });

export const Spectral = fonteFalsa;
export const IBM_Plex_Mono = fonteFalsa;
export const Inter = fonteFalsa;
export const Space_Grotesk = fonteFalsa;
export const IBM_Plex_Sans = fonteFalsa;
export const JetBrains_Mono = fonteFalsa;

/** Rede para acesso via namespace/default; imports nomeados usam os exports acima. */
const qualquerFonte = new Proxy({}, { get: () => fonteFalsa });
export default qualquerFonte;
