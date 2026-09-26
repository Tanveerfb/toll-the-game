import Link from "next/link";
import CharacterBrowser, {
  type CharacterBrowserItem,
} from "@/components/game/CharacterBrowser";
import {
  getCharacterMechanics,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <Screen width="app">
      <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* This page took the roster listing over from `/profile` on
            2026-08-11, which is why it opens on what you own. */}
        <SectionHeader eyebrow="Bureau roster index" title="Character Archive" />
        <Link
          href="/archive/npc"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
        >
          NPC index
        </Link>
      </header>

      {/* No `mt-5`: `Screen`'s inner column is a flex stack with its own gap,
          so a margin here would add to it. Rhythm is the shell's job now. */}
      <CharacterBrowser characters={characters} />
    </Screen>
  );
}
