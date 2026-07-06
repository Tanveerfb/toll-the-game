"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/AuthProvider";
import { firebaseEnabled } from "@/lib/firebase";

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    router.replace("/profile");
    return null;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(email, password);
      }
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full border-2 border-zinc-700 bg-black/40 px-4 py-3 font-body text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-400";

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 py-10">
        <Card className="w-full rounded-none border-2 border-zinc-700 bg-black/55 ring-0 backdrop-blur-sm">
          <CardHeader className="border-b border-zinc-700 px-6 py-6">
            <CardTitle className="font-heading text-4xl tracking-[0.14em] text-zinc-100">
              {mode === "login" ? "LOGIN" : "SIGN UP"}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 px-6 py-8">
            {!firebaseEnabled ? (
              <p className="font-body text-sm text-zinc-400">
                Accounts are not configured on this build. The game is fully
                playable in guest mode.
              </p>
            ) : (
              <>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <input
                  className={inputClass}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />

                {error && (
                  <p className="font-body text-sm text-red-400">{error}</p>
                )}

                <Button
                  disabled={busy || !email || !password}
                  onClick={submit}
                  className="h-12 rounded-none border-2 border-amber-300 font-heading tracking-[0.14em]"
                >
                  {mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={google}
                  className="h-12 rounded-none border-2 border-zinc-400 bg-transparent font-heading tracking-[0.14em] text-zinc-100"
                >
                  CONTINUE WITH GOOGLE
                </Button>

                <button
                  type="button"
                  className="mt-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setError(null);
                  }}
                >
                  {mode === "login"
                    ? "Need an account? Sign up"
                    : "Have an account? Login"}
                </button>
              </>
            )}

            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="h-12 rounded-none border-2 border-zinc-700 font-heading tracking-[0.14em] text-zinc-300"
            >
              BACK TO MENU
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
