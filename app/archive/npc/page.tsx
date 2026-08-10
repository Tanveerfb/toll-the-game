import CharacterBrowser, {
  type CharacterBrowserItem,
} from "@/components/game/CharacterBrowser";
import {
  getAllCharacters,
  getCharacterMechanics,
} from "@/lib/game/characterCatalog";

// Reachable from the CHARACTER ARCHIVE page ("NPC index" button) or by URL.
// Shows the story-only NPC/enemy kits the regular archive filters out.
const characters: CharacterBrowserItem[] = getAllCharacters()
  .filter((character) => character.storyOnly === true)
  .map((character) => ({
    id: character.id,
    name: character.name,
    color: character.color,
    atk: character.atk,
    def: character.def,
    hp: character.hp,
    tags: character.tags ?? [],
    mechanics: getCharacterMechanics(character),
  }));

export default function NpcArchivePage() {
  return (
    <main className="terminal-grid min-h-screen bg-void">
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="border-l-2 border-signal pl-3">
          <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
            Hostile contact index
          </span>
          <h1 className="font-heading text-3xl leading-none tracking-[0.1em] text-readout md:text-4xl">
            NPC Archive
          </h1>
          <p className="mt-1.5 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            Story-only enemies — not part of the playable roster
          </p>
        </header>

        <div className="mt-5">
          <CharacterBrowser characters={characters} />
        </div>
      </section>
    </main>
  );
}
