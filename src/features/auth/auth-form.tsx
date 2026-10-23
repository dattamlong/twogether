"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Vi } from "@/components/ui/panel";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

const schema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
  displayName: z.string().trim().min(1, "Tell us your name.").max(24, "Keep it under 24 characters.").optional(),
});

const fieldClass =
  "h-12 w-full rounded-2xl border-2 border-lavender-100 bg-white px-4 text-plum-700 outline-none transition focus:border-sakura-300 focus:shadow-[var(--shadow-glow)]";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ en: string; vi?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nextPath = (() => {
    const next = params.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  })();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      displayName: mode === "signup" ? form.get("displayName") : undefined,
    });
    if (!parsed.success) {
      setError({ en: parsed.error.issues[0].message });
      return;
    }

    setPending(true);
    const supabase = getSupabase();
    const { email, password, displayName } = parsed.data;
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: displayName },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          });
    setPending(false);

    if (result.error) {
      setError(friendlyError(result.error));
      return;
    }
    if (!result.data.session) {
      setNotice("Check your inbox to confirm your email, then come back to sign in.");
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <Vi>{mode === "login" ? "Chào mừng bạn quay lại" : "Tạo tài khoản của bạn"}</Vi>
      </div>

      {mode === "signup" ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Your name
          <input name="displayName" autoComplete="nickname" maxLength={24} required className={fieldClass} placeholder="Mai" />
        </label>
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Email
        <input name="email" type="email" autoComplete="email" required className={fieldClass} placeholder="you@example.com" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
          className={fieldClass}
        />
      </label>

      {error ? (
        <p role="alert" className="rounded-2xl bg-sakura-50 px-4 py-3 text-sm text-plum-700">
          {error.en}
          {error.vi ? <Vi className="text-xs">{error.vi}</Vi> : null}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-2xl bg-mint-100 px-4 py-3 text-sm text-plum-700">
          {notice}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-cocoa-400">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link className="font-semibold text-sakura-500 underline-offset-2 hover:underline" href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
