import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Design of Experiments: planejamento de experimentos no navegador, grátis na versão beta";

/** OG de compartilhamento: marca + slogan sobre o navy noturno da capa. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(180deg, #030C18 0%, #062038 45%, #0B3355 80%, #17466E 100%)",
          color: "#EAF2FB",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "2px solid rgba(181,212,244,.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                background: "#B5D4F4",
                transform: "rotate(45deg)",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600 }}>
            <span>Design&nbsp;</span>
            <span style={{ color: "#B5D4F4" }}>of Experiments</span>
          </div>
          <div
            style={{
              marginLeft: "auto",
              border: "1px solid rgba(181,212,244,.35)",
              borderRadius: 999,
              padding: "8px 22px",
              fontSize: 22,
              color: "#9CC3EC",
            }}
          >
            versão beta · grátis
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#ffffff",
              maxWidth: 900,
            }}
          >
            Experimento não se planeja por palpite.
          </div>
          <div style={{ fontSize: 30, color: "#B5D4F4", maxWidth: 860 }}>
            Matriz, ANOVA, superfície de resposta e ponto ótimo, direto no
            navegador.
          </div>
          <div style={{ fontSize: 24, color: "#9CC3EC" }}>
            research.iacommurilo.com.br
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
