import { NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal";

/** Enlace mágico: valida el token y crea la sesión del portal del cliente. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? undefined;
  const payload = verifyPortalToken(token);
  const base = new URL(req.url).origin;
  if (!payload || !token) {
    return NextResponse.redirect(`${base}/portal?error=1`);
  }
  const res = NextResponse.redirect(`${base}/portal`);
  res.cookies.set("portal", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/portal",
    maxAge: 30 * 86_400,
  });
  return res;
}
