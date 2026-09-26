"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MountedDialog from "@/components/ui/MountedDialog";
import { cn } from "@/lib/utils";
import PlayerAvatar from "@/components/game/PlayerAvatar";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { firebaseEnabled } from "@/lib/firebase";
import { TUTORIAL_STEPS } from "@/lib/tutorial/steps";

/**
 * Account management: who you're signed in as, what that does for your save,
 * the display picture, and the way out.
 *
 * Sign-out lives in here rather than on the page because it used to be the
 * single loudest control on `/profile` — a full-width red button directly
 * above an equally large "Back to menu", so the two most emphasised things on
 * the page were both ways to leave.
 */

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2 last:border-b-0">
      <span className="shrink-0 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-body text-sm">
        {value}
      </span>
    </div>
  );
}

export default function AccountModal({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const { user, logout } = useAuth();
  const router = useRouter();
  const roster = usePlayerStore((s) => s.roster);
  const avatarId = useSettingsStore((s) => s.avatarCharacterId);
  const setAvatarId = useSettingsStore((s) => s.setAvatarCharacterId);
  const seenTutorialSteps = useSettingsStore((s) => s.seenTutorialSteps);
  const tutorialDismissed = useSettingsStore((s) => s.tutorialDismissed);
  const resetTutorial = useSettingsStore((s) => s.resetTutorial);
  const [signingOut, setSigningOut] = React.useState(false);

  const tutorialSeenCount = TUTORIAL_STEPS.filter(
    (step) => seenTutorialSteps[step.id],
  ).length;

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Guest";

  const provider = user?.providerData?.[0]?.providerId;
  // Google is the only method offered since 2026-08-13, but `password` stays
  // mapped: an account created before that still signs in and should see what
  // it actually used rather than a raw provider id.
  const providerLabel =
    provider === "google.com"
      ? "Google"
      : provider === "password"
        ? "Email & password (legacy)"
        : provider
          ? provider
          : "—";

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <MountedDialog
      title="Account"
      description={user ? "Signed in" : "Playing as a guest"}
      onClose={onClose}
    >
      <div className="space-y-5">
        <section className="flex items-center gap-3">
          <PlayerAvatar characterId={avatarId} fallback={displayName} size={56} />
          <div className="min-w-0">
            <p className="truncate font-heading text-xl tracking-title">
              {displayName}
            </p>
            <p className="truncate font-body text-caption text-muted-foreground">
              {user?.email ?? "Progress is stored on this device only"}
            </p>
          </div>
        </section>

        <section>
          <p className="mb-2 border-b border-rule pb-1.5 font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
            Display picture
          </p>
          {/* A portrait picker, not an upload: there's no storage bucket to
              upload to, and pretending otherwise would be a dead button. */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAvatarId(null)}
              aria-pressed={avatarId === null}
              aria-label="Use the initial instead"
              // Picked is the action yellow, as everywhere else.
              className={cn(
                "flex h-12 w-12 items-center justify-center border-2 font-heading text-lg transition-colors",
                avatarId === null
                  ? "border-border bg-primary text-primary-foreground"
                  : "border-rule text-muted-foreground hover:border-border",
              )}
            >
              {displayName.charAt(0).toUpperCase()}
            </button>
            {roster.map((id) => {
              const art = getCharacterArt(id);
              const name = getCharacterById(id)?.name ?? id;
              const active = avatarId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAvatarId(id)}
                  aria-pressed={active}
                  aria-label={name}
                  className={cn(
                    "relative h-12 w-12 overflow-hidden border-2 transition-colors",
                    active
                      ? "border-border ink-slab-primary"
                      : "border-rule hover:border-border",
                  )}
                >
                  {art ? (
                    <Image
                      src={art}
                      alt={name}
                      fill
                      sizes="48px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-heading text-lg text-muted-foreground">
                      {name.charAt(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-body text-caption text-muted-foreground">
            Chosen from characters you own. Stored on this device.
          </p>
        </section>

        <section>
          <p className="mb-1 border-b border-rule pb-1.5 font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
            Save
          </p>
          <Row
            label="Cloud save"
            value={
              !firebaseEnabled
                ? "Not configured on this build"
                : user
                  ? "On — syncs a beat after each change"
                  : "Off — sign in to enable"
            }
          />
          <Row label="Sign-in method" value={providerLabel} />
          {user ? (
            <Row
              label="Account id"
              value={
                <span className="font-mono text-caption">
                  {user.uid.slice(0, 12)}…
                </span>
              }
            />
          ) : null}
        </section>

        <section>
          <p className="mb-1 border-b border-rule pb-1.5 font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
            Tutorial
          </p>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 font-body text-caption leading-snug text-muted-foreground">
              {tutorialDismissed
                ? "Battle hints are turned off."
                : `${tutorialSeenCount} of ${TUTORIAL_STEPS.length} battle hints seen.`}
            </span>
            {/* The way back from Skip All. Without it that button is one-way,
                and a playtester needs to see these more than once. */}
            <Button
              variant="ghost"
              size="xs"
              onClick={resetTutorial}
              disabled={!tutorialDismissed && tutorialSeenCount === 0}
              className="shrink-0"
            >
              Show again
            </Button>
          </div>
        </section>

        <section className="flex flex-wrap gap-2 border-t-2 border-border pt-4">
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          ) : (
            <Button size="sm" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          )}
          <span className="flex-1" />
          <p className="max-w-[26ch] font-body text-label leading-snug text-muted-foreground">
            {user
              ? "Signing out clears local progress on this device; your cloud save keeps it."
              : "Guest progress lives in this browser and is lost if you clear site data."}
          </p>
        </section>
      </div>
    </MountedDialog>
  );
}
