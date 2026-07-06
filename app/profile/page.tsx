"use client";

import { Button, Card } from "@heroui/react";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/AuthProvider";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (!loading && !user) {
    router.replace("/login");
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 py-10">
        <Card
          variant="tertiary"
          className="w-full rounded-none border-2 border-zinc-700 bg-black/55 backdrop-blur-sm"
        >
          <Card.Header className="border-b border-zinc-700 px-6 py-6">
            <Card.Title className="font-heading text-4xl tracking-[0.14em] text-zinc-100">
              PROFILE
            </Card.Title>
          </Card.Header>

          <Card.Content className="flex flex-col gap-4 px-6 py-8">
            {loading ? (
              <p className="font-body text-sm text-zinc-400">Loading…</p>
            ) : (
              <>
                <div className="border-2 border-zinc-800 bg-black/40 px-4 py-4">
                  <p className="font-body text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Signed in as
                  </p>
                  <p className="mt-1 font-body text-sm text-zinc-100">
                    {user?.email ?? user?.displayName ?? user?.uid}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onPress={async () => {
                    await logout();
                    router.replace("/");
                  }}
                  className="h-12 rounded-none border-2 border-red-400 font-heading tracking-[0.14em] text-red-200"
                >
                  LOGOUT
                </Button>
              </>
            )}

            <Button
              variant="tertiary"
              onPress={() => router.push("/")}
              className="h-12 rounded-none border-2 border-zinc-700 font-heading tracking-[0.14em] text-zinc-300"
            >
              BACK TO MENU
            </Button>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
