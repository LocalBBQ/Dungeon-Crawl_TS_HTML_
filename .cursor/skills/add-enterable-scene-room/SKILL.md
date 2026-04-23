---
name: add-enterable-scene-room
description: Add an enterable room scenario inside a scene tile by reusing the Ogre's Den pattern (cave entrance obstacle, target sub-level, return flow, and optional quest hookup). Use when creating new enterable dens, caves, ruins, interiors, or boss rooms from overworld scene tiles.
---

# Add Enterable Scene Room

## Scope

Use this skill when adding a scene-tile room that the player enters from an overworld tile (like `ogreDen`) into a dedicated interior level (like `"Ogre's Den"`), then exits back to the source level.

This project's baseline reference path is:

- Exterior scene tile with entrance: `game/config/sceneTiles/ForestTiles.ts` (`ogreDen`).
- Interior scene tile definition: `game/config/sceneTiles/DungeonTiles.ts` (`ogreDenInterior`).
- Interior level wiring: `game/config/GameConfig.ts` (level `12`).
- Enter/exit runtime logic: `game/core/PlayingStateController.ts`.

## Required Workflow

### 1) Add the exterior entry tile (or update an existing one)

In the relevant biome tile file (for example `game/config/sceneTiles/ForestTiles.ts`):

- Create/update a tile id that will host the entrance (`myDen`, `ruinedVaultEntrance`, etc.).
- Add a `caveEntrance` obstacle with:
  - `targetLevel` = interior level id
  - `returnLevel` = level id to return to after exit
  - `passable: true`
- Keep entry geometry large enough for reliable overlap (`~100x80` works well here).

Example shape:

```ts
{ type: 'caveEntrance', x: 455, y: 385, width: 100, height: 80, targetLevel: 12, returnLevel: 1, passable: true }
```

### 2) Add the interior scene tile layout

In `game/config/sceneTiles/DungeonTiles.ts` (or a matching interior tiles file):

- Add a new interior tile id (`myDenInterior`).
- Use fixed-size interior dimensions (`1200x1200`) unless your scenario needs a different one.
- Add obstacles/cover/landmarks tuned for your encounter.
- Omit `spawn` when the level is boss-only; add it for pack-based encounters.

### 3) Wire tile selection in level config

In `game/config/GameConfig.ts`:

- Add your exterior tile id into the source level `sceneTileLayout.pool`.
- Add a dedicated interior level entry (usually 1x1, `worldWidth/worldHeight: 1200`).
- Set interior `obstacles.sceneTileLayout.pool` to your interior tile id (for example `dungeon.myDenInterior`).
- Configure encounter data (`bossSpawn`, `enemyTypes`, `killsToUnlockPortal`, theme).

### 4) Ensure runtime enter/return behavior is correct

In `game/core/PlayingStateController.ts`:

- Entrance handling already reads `caveEntrance` obstacle `targetLevel`/`returnLevel`, stores `portalReturnLevel`, and serializes the source map before entering.
- If your scenario needs a custom exit rule, implement it alongside the existing Ogre logic:
  - spawn `caveExit` when your completion condition is met
  - keep `caveExit` `passable: true`
  - on overlap + `E`, return to `portalReturnLevel`
- Avoid hardcoding new scenario behavior to Ogre constants unless this scenario is truly Ogre-specific.

### 5) Register scenario constants when needed

If this scenario should be treated as a named special level:

- Add a constant in `game/config/questConfig.ts` (similar to `OGRE_DEN_LEVEL`).
- Reuse that constant in `PlayingStateController` and other logic instead of magic numbers.

### 6) Optional: quest board / main quest integration

If this enterable room should be player-selectable from hub quests:

- Add a static quest in `game/config/staticQuests.ts` using appropriate objective (`killBoss`, `clearArea`, etc.).
- If needed, add special description lines in `game/config/questConfig.ts` `getQuestDescription(...)` for the new level id.

## Acceptance Checklist

- [ ] Exterior tile contains a valid `caveEntrance` with `targetLevel`, `returnLevel`, `passable`.
- [ ] Source level pool includes the exterior entry tile id.
- [ ] Interior level exists in `GameConfig.levels` and points to the intended interior scene tile.
- [ ] Entering channels correctly on `E` and loads the interior scenario.
- [ ] Exiting returns to the intended source level.
- [ ] Exit spawn condition matches scenario completion rules.
- [ ] No TypeScript errors.

## Guardrails

- Do not add `targetLevel` without creating the corresponding level config.
- Do not hardcode return-to-level behavior when `returnLevel` can be read from entrance obstacle data.
- Do not spawn `caveExit` before scenario completion unless intentionally designing a free-exit room.
- Do not forget to add the exterior tile id to the source level's `sceneTileLayout.pool`; otherwise the room never appears.
