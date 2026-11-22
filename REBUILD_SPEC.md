# AI-TRPG Rebuild v2 — Product Specification

## Rebuild policy
- This branch is a clean rebuild track. Do not treat the previous UI, SVG scene system, or existing implementation as the design baseline.
- Keep the existing DICE RPG project and its files completely separate and unchanged.
- Do not replace the currently deployed production build until the new build passes automated checks and browser-level playthrough checks.
- Preserve confirmed game rules and world data. Never fill missing values by guessing; mark them as unresolved and request confirmation only when implementation depends on them.

## Product direction
- Full-screen browser RPG with a polished, image-led fantasy JRPG presentation.
- Visual quality target: bright, richly detailed, stylized 3D/anime fantasy presentation in the broad direction of modern console/mobile JRPGs. Do not copy protected characters, maps, logos, UI layouts, or assets.
- No SVG-generated character art or scene illustrations. Use raster artwork for backgrounds, characters, portraits, monsters, and item art. SVG may be used only for simple functional interface icons if necessary.
- Keep the world map's established terrain/geography unchanged; remove text labels and place names from the map art.
- AI-TRPG is its own game, separate from DICE RPG. The bonus DICE RPG mode remains a separate experience.

## Modes and saves
- Online mode: single-player and multiplayer.
- Offline mode: single-player only.
- Story mode and bonus mode are independent. The player can switch to the bonus mode and return to the story without losing the story save or progress.

## Character creation and guild flow
- Do not ask the player to choose a job/class in the initial character-creation step.
- Character creation proceeds through identity/background and AI review.
- The guild NPC conducts the job/class assessment and presents the resulting choice/assignment as part of the story.
- The AI reviewer must give a concrete reason and actionable feedback when rejecting a character setting.
- After 3 or more rejections, provide an AI GM fallback: generate exactly 3 story-fitting character-background recommendations, each at least 200 Korean characters. Show the user's feedback/opinion field so the player can explain what is not working. The player selects one recommendation, it fills the setting, and the review runs again.
- If the AI service is unavailable or access is denied, show a clear retry/service-unavailable state. Never fake an AI review or pretend a generated recommendation came from the model.

## Confirmed character stats and generation
- HP: roll 1d250; if result is below 150, final HP is 150.
- Strength, Intelligence, Defense: each 1d50.
- Luck: 1d25.
- Speed: 1d30.
- Precision: 1d40.
- Starting SP: 25.
- Racial bonuses:
  - Human: Strength +5, Intelligence +5.
  - Elf: Intelligence +10.
  - Orc: HP +10.
  - Dwarf: Strength +10.
  - Mermaid: Speed +10.
- Level-up uses stat points; HP cannot be increased by spending stat points.
- Preserve the previously confirmed stat-growth, SP maximum/recovery, and level-up behavior from the authoritative rules. Do not invent missing values.

## Class stat caps
Each class has four stat caps. Confirmed values:
- Fighter: Strength 250.
- Mage: Intelligence 250.
- Brawler: Strength 200, Speed 250.
Other class/stat caps are unresolved. Do not infer them.

## Combat and systems
- Preserve the original DICE RPG hit and defense resolution where the AI-TRPG rules explicitly reference it; do not simplify or replace established calculations.
- Preserve all confirmed skills, formulas, SP costs, equipment, item effects, monster abilities, and reward rules from the user's AI-TRPG rule decisions.
- Keep a deterministic rules engine separate from AI narration. AI GM can narrate, review, and propose story content, but must not silently alter combat calculations, player stats, inventory, rewards, or established world facts.
- Combat log must expose relevant rolls, calculations, SP costs/recovery, active effects, and resulting HP/SP changes.

## Architecture principles
- Separate domain rules, content data, UI, persistence, multiplayer/session services, and AI GM adapters.
- AI provider access must be replaceable through a server-side adapter; never expose provider secrets in browser code.
- Validate all AI outputs against schemas and game constraints before using them.
- Save state versioning and migrations are required.
- Provide deterministic tests for character generation, combat, skills, items, progression, saves, and AI-output validation.
- Provide explicit mock mode for automated tests; label mock responses as mock and never present them as live AI output.

## Acceptance gates before production
1. Clean install/build succeeds.
2. Unit and integration tests pass for the rules engine.
3. Browser tests cover new game → character setup → guild assessment → exploration → combat → reward → save/load.
4. Online/offline mode restrictions and save isolation are tested.
5. AI review and the 3-option fallback are tested with a live provider separately from mock tests.
6. Accessibility, responsive layout, asset loading, and runtime errors are checked.
7. Only then promote the rebuild to production.
