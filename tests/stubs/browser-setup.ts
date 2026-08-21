/**
 * Browser-mode setup: load the game's real stylesheet.
 *
 * Without this, components render unstyled — and unstyled is not neutral, it
 * actively falsifies results. A card with no CSS is a block element that fills
 * its parent, so "is this card at least 56px wide?" passes at any viewport
 * regardless of whether `min-w-14` exists at all. A test that passes for the
 * wrong reason is worse than no test, because it also stops anyone looking.
 *
 * Vite runs this through the project's postcss config, which is where Tailwind
 * lives, so the classes under test resolve to the same rules the game ships.
 */
import "@/styles/globals.css";
