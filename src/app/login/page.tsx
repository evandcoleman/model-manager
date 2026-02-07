import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  if (process.env.DESKTOP_MODE === "true") {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Model Manager
          </h1>
          <p className="text-sm text-muted mt-1">Sign in to continue</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
