---
name: dokkanartresearch
description: Find, view and save Dokkan Battle card art as pose and composition references for a character's kit art, using dokkandb.com in the built-in browser. Use whenever Tanveer wants pose research, "look at Dokkan for poses", names a Dokkan card for a skill or ultimate, or says "/dokkanartresearch". Covers the search quirks, the character-layer URL, the viewing trick, the save gate and the library index.
---

# dokkanartresearch

Pose and composition research for kit art (`charart` step 3). He drafts against
Dokkan the way he drafts kit words against it (`kitwords`): **take the pose and
the framing, drop everything else.** The art never reaches a sampler.

## Where the truth lives

- ComfyUI `output\references\README.md`: the library index. Every set saved gets
  a row there. **Read it first**; a pose may already be saved.
- ComfyUI `output\references\dokkan\`: the Dokkan sets (`roster-tiles_*`,
  `surge-powerup-ref_*`, `duke-poses_*`, `skeletons\`).
- `docs/CHARACTER_ART.md` rule 4 and step 3: references are pose and composition
  only, never a sampler input, never in this repo.
- `scripts/pose/` and `docs/CHARACTER_ART.md` step 3: how a pose becomes a
  Blender mannequin.

If those files are deleted, delete this skill in the same commit.

## Gates (his, and they bind)

1. **Saving an image is a download. Ask first, once per session.** His standing
   words on 2026-10-07: *"You can. Dokkandb and dokkaninfo are best sources for
   me"* and *"You can also save the images to dokkan ref folder, the ones you
   like."* That covers dokkandb.com and dokkaninfo.com for the session it was
   given in. A new session asks again. Anything from another site asks too.
2. **Pose and composition only.** Never IP-Adapter, never img2img, never in the
   game repo.
3. **He picks the pose.** A reference he names (*"LR PHY Ultra Instinct Goku"*)
   is the one to use; don't swap in a look-alike. If you can't find it, say so
   and ask for the card number.

## Finding a card on dokkandb.com

- **Open `https://dokkandb.com/cards?search=<Name>&page=1`** in the built-in
  browser. Wait about 5 seconds: the list renders late, and a screenshot taken
  too soon times out. Retry it.
- **Search matches card names only.** "Ultra Instinct" finds 7 Gokus; "Kick" or
  "pose" finds nothing. Search a character, then look.
- **The GLB / JP switch is a trap.** The top bar has a toggle. On JP the global
  cards show 0 results. If a search that should work is empty, find the
  `Switch to Global` button and click it. (Hit on 2026-10-07: JP showed 0.)
- **A card's id is in its link:** `/cards/1032921`. The LR in a name such as
  *"Goku (Ultra Instinct -Sign-) + Super Saiyan God SS Evolved Vegeta"* may be
  one of several cards with one name. The page shows the rarity; confirm it.
- The card page itself opens a video player and a lot of text. Don't read it
  for the art; use the file below.

## The art file

The character layer, transparent, 426×568:

`https://api.dokkandb.com/assets/character/card/<id>0_folder/card_<id>0_character.png`

where `<id>0` is the card id with its **last digit replaced by 0** (card
`1032921` → `1032920`). Sibling files in the same folder: `_bg.png`, `_effect.png`.
The thumbnail and the full card (with frame) are elsewhere; this is the figure
alone, which is what a pose reference needs.

## Looking at many at once

The browser pane cannot open a local HTML file with remote images. Do this on
the dokkandb.com origin instead: run `javascript_tool` on any dokkandb page and
replace `document.body` with a flex grid of `<img>` tags pointing at the URL
above (id as a caption, `height:230px`, grey background so the transparent art
reads). Wait 5 seconds, then screenshot. Twelve to twenty-four fit one view.
Collect ids first with
`document.querySelectorAll('a[href*="/cards/"]')` on a results page.

## Which cards to look at

His tip (2026-10-07): *"look at Majin Buu saga characters or Android Cell saga.
They have the most dynamic poses."* What that gave for Duke:

| Need | Good source |
| --- | --- |
| Power-up (Surge) | LR PHY UI Goku (-Sign-) + SSGSS Evolved Vegeta, card 1032921: floating, fists at the chest, head back, mouth open |
| Drop kick / low kick (Slide) | Gotenks 1025641 (drop kick, boot big to the lens), Gotenks SSJ3 1006211 (flying kick), UI Goku 1029051 (low leap) |
| Wide low stance (Garou-like ultimate) | Buu 1012001 and 1020371, Hit 1031121 and 1023171 (lunge, fist to the lens), UI Goku 1019821 and 1020311 |
| Searched, little use | "Cell": mini-Cells and insectoid poses |

dokkaninfo.com is his other preferred source and was **not** explored on
2026-10-07. Check its image URL pattern before assuming it matches dokkandb's.

## Saving

1. Folder: `output\references\dokkan\<slot-or-topic>_<YYYY-MM-DD>\`.
2. Name each file `<character>_<card id>_<pose words>.png`, never by the
   source's file name.
3. Add a row to the library README the same minute: what, source, the
   permission, and which skeletons came out usable.

## Turning a reference into a pose

- **DWPose is unreliable on this art.** Run both passes (yolox, then
  `bbox_detector: None`) and expect about half to be usable; it read the Goku
  power-up with the forearms sideways. Pad the image to 832×1216, never
  stretch it (a stretched crop gave a stretched skeleton).
- **The dependable route is a hand-written mannequin pose** (`scripts/pose/`)
  written from what the reference shows, previewed as a depth map before any GPU
  run. Frame it the way the references do: a wide lens, a low or high angle, a
  dutch tilt, a limb or boot big toward the lens, the figure cropped by the
  frame. A centred, full-length, front-on figure is the model-sheet look, and
  it was the first thing that went wrong with Duke's drafts.
- Scale the mannequin to the character: `height` and `thickness` in the pose
  JSON. The default figure is a slim 5'3" woman and made Duke read as a teen.
- Never draw a wrist above the head (arm-up is auto-rejected).

## Mistakes already made, so don't repeat them

- Taking the first DokkanDB hit for a named card instead of confirming the
  rarity he named.
- Searching on the JP list and concluding a card doesn't exist.
- Judging a figure at contact-sheet size and calling the anatomy fine.
- Building poses before looking at the locked art of the other characters.
