import CharacterBrowser, {
  type CharacterBrowserItem,
} from "@/components/game/CharacterBrowser";
import {
  getAllCharacters,
  getCharacterMechanics,
} from "@/lib/game/characterCatalog";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";

// Reachable from the CHARACTER ARCHIVE page ("NPC index" button) or by URL.
// Shows the story-only NPC/enemy kits the regular archive filters out.
const characters: CharacterBrowserItem[] = getAllCharacters()
  .filter((character) => character.storyOnly === true)
  .map((character) => ({
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
  }));

export default function NpcArchivePage() {
  return (
    <Screen width="app">
      <SectionHeader eyebrow="Hostile contact index" title="NPC Archive">
        <p className="mt-2 font-body text-caption font-bold uppercase tracking-label text-ground-dim">
          Story-only enemies — not part of the playable roster
        </p>
      </SectionHeader>

      {/* No ownership treatment: these kits can never be acquired, so a
          Locked badge and a greyed portrait describe a permanent state of
          affairs rather than something the player can change
          (Tanveer, 2026-08-13). */}
      <CharacterBrowser characters={characters} ownership={false} />
    </Screen>
  );
}
