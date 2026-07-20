import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CharacterBrowser, {
  type CharacterBrowserItem,
} from "@/components/game/CharacterBrowser";
import {
  getAllCharacters,
  getCharacterMechanics,
} from "@/lib/game/characterCatalog";

// Reachable from the CHARACTER ARCHIVE page ("NPC Archive" button) or by URL.
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
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(70% 45% at 90% 0%, rgba(244,63,94,0.16), transparent 75%), radial-gradient(60% 40% at 5% 100%, rgba(245,158,11,0.2), transparent 72%), linear-gradient(155deg, #09090b 0%, #0f172a 50%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[38px_38px] opacity-25" />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
        <Card className="rounded-none border-2 border-zinc-700 bg-black/55 shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-0">
          <CardHeader className="border-b border-zinc-700 px-6 py-6 md:px-8">
            <CardTitle className="font-heading text-4xl tracking-[0.12em] text-zinc-100 md:text-6xl">
              NPC ARCHIVE
            </CardTitle>
            <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
              Story-only enemies — not part of the playable roster
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 md:p-8">
            <CharacterBrowser characters={characters} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
