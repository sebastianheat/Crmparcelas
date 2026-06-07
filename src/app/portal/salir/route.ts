import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set("portal", "", { path: "/portal", maxAge: 0 });
  return res;
}
