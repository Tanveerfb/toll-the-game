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
    cardNumber: character.cardNumber,
    heading: character.heading,
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
    <main className="terminal-grid min-screen-below-nav bg-void">
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-l-2 border-signal pl-3">
          <div>
            <span className="block font-body text-[10px] font-bold uppercase tracking-eyebrow text-signal">
              Bureau roster index
            </span>
            {/* Steps down at 390 so NPC index fits beside it instead of
                wrapping to a row of its own — that wrap was ~60px of the 274
                standing between the top of this screen and the first unit. */}
            <h1 className="font-heading text-2xl leading-none tracking-title text-readout sm:text-3xl sm:tracking-label md:text-4xl">
              Character Archive
            </h1>
            {/* This page took the roster listing over from `/profile` on
                2026-08-11, which is why it opens on what you own. */}
          </div>
          <Link
            href="/archive/npc"
            className="chamfer ml-auto inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border border-edge px-2.5 py-2 font-body text-[11px] font-bold uppercase tracking-label text-readout-dim transition-colors hover:border-edge-strong hover:text-signal sm:px-3 sm:tracking-eyebrow"
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
