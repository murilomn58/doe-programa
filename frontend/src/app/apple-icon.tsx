import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícone iOS: mesma marca do favicon, raio maior. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#042C53",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: "50%",
            border: "5px solid rgba(181,212,244,.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "#B5D4F4",
              transform: "rotate(45deg)",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
