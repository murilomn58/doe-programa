import { NextResponse } from "next/server";
import { validarEmail } from "@/lib/conta";

export const runtime = "nodejs";

type Lead = { email: string; origem: "doe-app"; ts: string };

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "json inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!validarEmail(email)) {
    return NextResponse.json({ ok: false, erro: "e-mail inválido" }, { status: 422 });
  }

  const lead: Lead = { email, origem: "doe-app", ts: new Date().toISOString() };

  // Persistência: Vercel Blob se houver token; senão degrada (dev/local).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      await put(
        `conta/${lead.origem}/${lead.ts.replace(/[:.]/g, "-")}-${lead.email}.json`,
        JSON.stringify(lead),
        { access: "public", contentType: "application/json", addRandomSuffix: true },
      );
    } catch (e) {
      console.error("[conta] falha ao gravar no blob:", e);
      // não falha o usuário por erro de storage; lead já foi validado
    }
  } else {
    console.warn("[conta] BLOB_READ_WRITE_TOKEN ausente — lead não persistido:", lead);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
