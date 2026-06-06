import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/app");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-600">
              Parcelasy
            </span>
          </div>
          <p className="text-sm text-slate-500">
            CRM de parcelas <span className="text-slate-400">· by HEAT</span>
          </p>
        </div>
        <Card className="p-6">
          <LoginForm />
        </Card>
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin@parcelasy.cl · Parcelasy2026
        </p>
      </div>
    </div>
  );
}
