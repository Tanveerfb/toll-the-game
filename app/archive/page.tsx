import Link from "next/link";
import CharacterBrowser, {
  type CharacterBrowserItem,
} from "@/components/game/CharacterBrowser";
import {
  getCharacterMechanics,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";

const characters: CharacterBrowserItem[] = getPlayableCharacters().map(
  (character) => ({
    id: character.id,
    name: character.name,
    color: character.color,
    atk: character.atk,
    def: character.def,
    hp: character.hp,
    tags: character.tags ?? [],
    mechanics: getCharacterMechanics(character),
  }),
);

export default function ArchivePage() {
  return (
    <main className="terminal-grid min-h-screen bg-void">
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-l-2 border-signal pl-3">
          <div>
            <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
              Bureau roster index
            </span>
            <h1 className="font-heading text-3xl leading-none tracking-[0.1em] text-readout md:text-4xl">
              Character Archive
            </h1>
            {/* This page took the roster listing over from `/profile` on
                2026-08-11, which is why it opens on what you own. */}
            <p className="mt-1 font-body text-[11px] text-readout-muted">
              Your characters and their progression. Locked units are hidden
              until you ask for them.
            </p>
          </div>
          <Link
            href="/archive/npc"
            className="chamfer ml-auto border border-edge px-3 py-2 font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
          >
            NPC index
          </Link>
        </header>

        <div className="mt-5">
          <CharacterBrowser characters={characters} />
        </div>
      </section>
    </main>
  );
}
