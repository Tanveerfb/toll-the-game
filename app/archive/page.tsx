import { Card } from "@heroui/react";
import CharacterBrowser, {
  type CharacterBrowserItem,
} from "@/components/game/CharacterBrowser";
import { getAllCharacters } from "@/lib/game/characterCatalog";

const characters: CharacterBrowserItem[] = getAllCharacters().map(
  (character) => ({
    id: character.id,
    name: character.name,
    color: character.color,
    atk: character.atk,
    def: character.def,
    hp: character.hp,
  }),
);

export default function ArchivePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(70% 45% at 90% 0%, rgba(56,189,248,0.18), transparent 75%), radial-gradient(60% 40% at 5% 100%, rgba(245,158,11,0.2), transparent 72%), linear-gradient(155deg, #09090b 0%, #0f172a 50%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[38px_38px] opacity-25" />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
        <Card
          variant="tertiary"
          className="rounded-none border-2 border-zinc-700 bg-black/55 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        >
          <Card.Header className="border-b border-zinc-700 px-6 py-6 md:px-8">
            <Card.Title className="font-heading text-4xl tracking-[0.12em] text-zinc-100 md:text-6xl">
              CHARACTER ARCHIVE
            </Card.Title>
          </Card.Header>

          <Card.Content className="p-6 md:p-8">
            <CharacterBrowser characters={characters} />
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
