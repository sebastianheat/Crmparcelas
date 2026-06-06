// Next.js 16 renombró `middleware` → `proxy` (runtime nodejs).
// Protege las rutas de la app: sin sesión, redirige a /login.
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isAppRoute = pathname.startsWith("/app");

  if (isAppRoute && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  // Excluye estáticos y la API de auth.
  matcher: ["/app/:path*"],
};
