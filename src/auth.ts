import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db/client";
import { memberships, users, type Role } from "@/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });
        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        // Tenant activo = primera membresía (multi-tenant switch llega luego).
        const membership = await db.query.memberships.findFirst({
          where: eq(memberships.userId, user.id),
          with: { tenant: true },
        });
        if (!membership) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          // Campos extendidos transportados al JWT.
          tenantId: membership.tenantId,
          tenantName: membership.tenant.name,
          tenantSlug: membership.tenant.slug,
          role: membership.role,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          tenantId: string;
          tenantName: string;
          tenantSlug: string;
          role: string;
        };
        token.uid = u.id;
        token.tenantId = u.tenantId;
        token.tenantName = u.tenantName;
        token.tenantSlug = u.tenantSlug;
        token.role = u.role as never;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as unknown as {
        uid: string;
        tenantId: string;
        tenantName: string;
        tenantSlug: string;
        role: Role;
      };
      session.user.id = t.uid;
      session.tenantId = t.tenantId;
      session.tenantName = t.tenantName;
      session.tenantSlug = t.tenantSlug;
      session.role = t.role;
      return session;
    },
  },
});
