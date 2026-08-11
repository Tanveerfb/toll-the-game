"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DetailOverlay from "@/components/game/DetailOverlay";
import PlayerAvatar from "@/components/game/PlayerAvatar";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { firebaseEnabled } from "@/lib/firebase";

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
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-2 last:border-b-0">
      <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-body text-sm text-readout">
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
  const [signingOut, setSigningOut] = React.useState(false);

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Guest";

  const provider = user?.providerData?.[0]?.providerId;
  const providerLabel =
    provider === "google.com"
      ? "Google"
      : provider === "password"
        ? "Email & password"
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
    <DetailOverlay
      title="Account"
      subtitle={user ? "Signed in" : "Playing as a guest"}
      onClose={onClose}
    >
      <div className="space-y-5">
        <section className="flex items-center gap-3">
          <PlayerAvatar characterId={avatarId} fallback={displayName} size={56} />
          <div className="min-w-0">
            <p className="truncate font-heading text-xl tracking-[0.06em] text-readout-strong">
              {displayName}
            </p>
            <p className="truncate font-body text-[11px] text-readout-muted">
              {user?.email ?? "Progress is stored on this device only"}
            </p>
          </div>
        </section>

        <section>
          <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
            Display picture
          </p>
          {/* A portrait picker, not an upload: there's no storage bucket to
              upload to, and pretending otherwise would be a dead button. */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAvatarId(null)}
              aria-pressed={avatarId === null}
              title="Use the initial instead"
              className={`flex h-12 w-12 items-center justify-center border font-heading text-lg transition-colors ${
                avatarId === null
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-edge text-readout-dim hover:border-edge-strong"
              }`}
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
                  title={name}
                  className={`relative h-12 w-12 overflow-hidden border transition-colors ${
                    active
                      ? "border-signal"
                      : "border-edge hover:border-edge-strong"
                  }`}
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
                    <span className="flex h-full w-full items-center justify-center font-heading text-lg text-readout-dim">
                      {name.charAt(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-body text-[11px] text-readout-muted">
            Chosen from characters you own. Stored on this device.
          </p>
        </section>

        <section>
          <p className="mb-1 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
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
                <span className="font-mono text-[11px]">
                  {user.uid.slice(0, 12)}…
                </span>
              }
            />
          ) : null}
        </section>

        <section className="flex flex-wrap gap-2 border-t border-hairline pt-4">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="border border-edge px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-readout-dim transition-colors hover:border-el-red hover:text-el-red disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="border border-signal bg-signal/10 px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-signal transition-colors hover:bg-signal/20"
            >
              Sign in
            </button>
          )}
          <span className="flex-1" />
          <p className="max-w-[26ch] font-body text-[10px] leading-snug text-readout-muted">
            {user
              ? "Signing out clears local progress on this device; your cloud save keeps it."
              : "Guest progress lives in this browser and is lost if you clear site data."}
          </p>
        </section>
      </div>
    </DetailOverlay>
  );
}
