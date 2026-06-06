import type { Role } from "@/db/schema";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
    };
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: Role;
  }
}
