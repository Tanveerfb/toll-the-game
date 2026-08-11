import { describe, expect, it } from "vitest";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * The archive took the roster listing over from `/profile` on 2026-08-11, so
 * it opens on what you own and keeps the rest one click away (Tanveer). These
 * pin the default — a flipped default silently turns the roster screen back
 * into a catalogue.
 */
describe("archive ownership defaults", () => {
  it("hides unowned characters by default", () => {
    expect(useSettingsStore.getState().showUnownedCharacters).toBe(false);
  });

  it("lets the toggle reveal them and put them back", () => {
    const { setShowUnownedCharacters } = useSettingsStore.getState();
    setShowUnownedCharacters(true);
    expect(useSettingsStore.getState().showUnownedCharacters).toBe(true);
    setShowUnownedCharacters(false);
    expect(useSettingsStore.getState().showUnownedCharacters).toBe(false);
  });

  it("defaults the display picture to none, so the initial shows", () => {
    expect(useSettingsStore.getState().avatarCharacterId).toBeNull();
  });
});
