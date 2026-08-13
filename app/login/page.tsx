"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CloudUpload, ScrollText, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { firebaseEnabled } from "@/lib/firebase";
import { getStarterOrders, summariseRewards } from "@/lib/game/orders";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * Sign-in.
 *
 * Rebuilt 2026-08-13 on the Combat Terminal palette — it was one of the last
 * two screens still on the pre-token zinc/amber utilities — and cut to
 * **Google only** at Tanveer's direction.
 *
 * Shaped like a game's sign-in rather than a form: key art behind, one
 * unmistakable button, and the reason to press it stated in rewards rather
 * than in the language of accounts. Guest play stays one tap away and is
 * never dressed up as a mistake — the game is fully playable without an
 * account, and pretending otherwise would be a lie the first battle exposes.
 */

/** Google's mark, inlined. A remote asset would be a request the CSP blocks
 *  and a dependency on someone else's CDN for a button that must never fail
 *  to render. Colours are Google's own, per their branding guidelines. */
function GoogleMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function Perk({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
}): React.JSX.Element {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-edge bg-inset text-signal">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-body text-sm font-semibold text-readout-strong">
          {title}
        </span>
        <span className="font-body text-xs leading-snug text-readout-muted">
          {detail}
        </span>
      </span>
    </li>
  );
}

export default function LoginPage(): React.JSX.Element {
  const { user, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Redirect in an effect, not during render — `router.replace()` mid-render
  // is a side effect React is entitled to run twice.
  React.useEffect(() => {
    if (user) router.replace("/profile");
  }, [user, router]);

  const signIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      router.replace("/");
    } catch (e) {
      // A closed popup is the common case and isn't an error worth shouting
      // about — it's the player changing their mind.
      const code = (e as { code?: string })?.code ?? "";
      if (code.includes("popup-closed") || code.includes("cancelled")) {
        setError(null);
      } else {
        setError(
          e instanceof Error ? e.message : "Sign-in failed. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // The pitch, in the currency the player cares about — read from the orders
  // themselves so it can't drift as rewards are tuned.
  const total = summariseRewards(getStarterOrders());
  const headline = total.characters
    .map((id) => getCharacterById(id)?.name ?? id)
    .join(", ");

  return (
    <main className="terminal-grid relative min-h-screen overflow-hidden bg-void">
      {/* Key art, pushed well back. It sets the tone; the panel does the work. */}
      <Image
        src="/banners/debut-2026-08.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover object-top opacity-25"
      />
      <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-void/70 via-void/85 to-void" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-5 py-10">
        <header className="border-l-2 border-signal pl-3">
          <span className="block font-heading text-2xl tracking-[0.28em] text-signal">
            TOLL
          </span>
          <h1 className="mt-1 font-heading text-3xl leading-none tracking-[0.06em] text-readout-strong">
            Bureau access
          </h1>
          <p className="mt-2 font-body text-sm text-readout-dim">
            Sign in to bank your progress and claim what you&apos;ve earned.
          </p>
        </header>

        <div className="chamfer-lg border border-edge-strong bg-panel/90 px-4 py-4 backdrop-blur-sm">
          {firebaseEnabled ? (
            <>
              <ul className="flex flex-col gap-3">
                <Perk
                  icon={ScrollText}
                  title="Bureau Orders unlock"
                  detail={
                    headline
                      ? `${headline} and ${total.gems.toLocaleString()} gems are waiting to be claimed.`
                      : `${total.gems.toLocaleString()} gems are waiting to be claimed.`
                  }
                />
                <Perk
                  icon={CloudUpload}
                  title="Your save follows you"
                  detail="Roster, ranks, materials and summons, on any device you sign in from."
                />
                <Perk
                  icon={ShieldCheck}
                  title="Nothing to fill in"
                  detail="One tap. We read your name, email and picture — nothing else."
                />
              </ul>

              <button
                type="button"
                onClick={signIn}
                disabled={busy}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 border border-edge-strong bg-readout-strong px-4 font-body text-sm font-semibold text-void transition-colors hover:bg-white disabled:opacity-60"
              >
                <GoogleMark />
                {busy ? "Opening Google…" : "Continue with Google"}
              </button>

              {error ? (
                <p
                  role="alert"
                  className="mt-3 border-l-2 border-el-red bg-el-red/5 px-3 py-2 font-body text-xs text-el-red"
                >
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-body text-sm leading-relaxed text-readout-dim">
              Accounts aren&apos;t configured on this build, so Bureau Orders
              stay open and progress is saved on this device only. Everything
              else plays exactly as it should.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted transition-colors hover:text-signal"
          >
            {firebaseEnabled ? "Play as a guest" : "Back to the menu"}
          </button>
          {firebaseEnabled ? (
            <p className="max-w-xs text-center font-body text-[11px] leading-snug text-readout-muted">
              Guest progress lives in this browser and is lost if you clear
              site data. You can sign in later and keep playing.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
