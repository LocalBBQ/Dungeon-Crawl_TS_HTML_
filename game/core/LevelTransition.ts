/**
 * Level transition and portal logic: full transition (clear + load level) and in-place advance (next area).
 * Game and PlayingStateController call into this module so all level-load behavior lives in one place.
 */
import { GameConfig } from '../config/GameConfig.js';
import { DELVE_LEVEL, DELVE_OBSTACLES_CONFIG, OGRE_DEN_LEVEL } from '../config/questConfig.js';

export interface LevelTransitionGameRef {
    playingState: {
        portal: { x: number; y: number; width: number; height: number; spawned: boolean; hasNextLevel: boolean; targetLevel: number } | null;
        delveFloor: number;
        lastEnemyKillX: number | null;
        lastEnemyKillY: number | null;
        portalReturnLevel: number | null;
        questSurviveStartTime?: number;
        activeQuest: { objectiveType?: string; questType?: string } | null;
        board: { x: number; y: number; width: number; height: number } | null;
        boardOpen: boolean;
        boardUseCooldown: number;
        playerNearBoard: boolean;
        chest: { x: number; y: number; width: number; height: number } | null;
        chestOpen: boolean;
        chestUseCooldown: number;
        playerNearChest: boolean;
        shop: { x: number; y: number; width: number; height: number } | null;
        shopOpen: boolean;
        shopUseCooldown: number;
        playerNearShop: boolean;
        rerollStation: { x: number; y: number; width: number; height: number } | null;
        rerollStationOpen: boolean;
        rerollStationUseCooldown: number;
        playerNearRerollStation: boolean;
        hubSelectedLevel: number;
        portalUseCooldown: number;
        recallPortal: { x: number; y: number; width: number; height: number; spawned: boolean } | null;
    };
    config: { levels?: Record<number, { board?: { x: number; y: number; width: number; height: number }; weaponChest?: { x: number; y: number; width: number; height: number }; shopkeeper?: { x: number; y: number; width: number; height: number }; rerollStation?: { x: number; y: number; width: number; height: number } }>; portal?: { width?: number; height?: number } };
    systems: { get(name: string): unknown };
    entities: unknown;
    canvas: HTMLCanvasElement;
    screenManager: { setScreen(screen: 'hub' | 'playing'): void };
    clearAllEntitiesAndProjectiles(): void;
    regenerateWorldForLevel(level: number): void;
    resetEnemyManager(level: number): void;
    initializeEntities(): void;
    setCurrentWorldSize(width: number, height: number): void;
    updateUIVisibility(visible: boolean): void;
}

export interface TransitionToLevelOptions {
    /** When entering a survive quest, set questSurviveStartTime (seconds). */
    questSurviveStartTime?: number;
}

/**
 * Performs a full transition to a level: clear entities, set hub state when level 0, regenerate world, reset enemies, init entities, set screen, update UI.
 * Caller (Game.startGame) is responsible for: quest completion/unlock when returning to hub, and camera setWorldBounds before calling this.
 */
export function transitionToLevel(game: LevelTransitionGameRef, levelId: number, options?: TransitionToLevelOptions): void {
    game.clearAllEntitiesAndProjectiles();
    game.playingState.recallPortal = null;
    game.regenerateWorldForLevel(levelId);

    const levels = game.config.levels || {};
    const hubLevel = levelId === 0 ? (levels[0] as { board?: { x: number; y: number; width: number; height: number }; weaponChest?: { x: number; y: number; width: number; height: number }; shopkeeper?: { x: number; y: number; width: number; height: number }; rerollStation?: { x: number; y: number; width: number; height: number } }) : null;

    if (levelId === 0 && hubLevel) {
        game.playingState.portal = null;
        game.playingState.board = hubLevel.board ? { ...hubLevel.board } : null;
        game.playingState.boardOpen = false;
        game.playingState.boardUseCooldown = 0.6;
        game.playingState.playerNearBoard = false;
        game.playingState.chest = hubLevel.weaponChest ? { ...hubLevel.weaponChest } : null;
        game.playingState.chestOpen = false;
        game.playingState.chestUseCooldown = 0.6;
        game.playingState.playerNearChest = false;
        game.playingState.shop = hubLevel.shopkeeper ? { ...hubLevel.shopkeeper } : null;
        game.playingState.shopOpen = false;
        game.playingState.shopUseCooldown = 0.6;
        game.playingState.playerNearShop = false;
        game.playingState.rerollStation = hubLevel.rerollStation ? { ...hubLevel.rerollStation } : null;
        game.playingState.rerollStationOpen = false;
        game.playingState.rerollStationUseCooldown = 0.6;
        game.playingState.playerNearRerollStation = false;
        game.playingState.hubSelectedLevel = 1;
    }

    game.resetEnemyManager(levelId);
    game.initializeEntities();

    if (levelId === 0 && hubLevel) {
        game.screenManager.setScreen('hub');
    } else {
        if (options?.questSurviveStartTime != null) {
            game.playingState.questSurviveStartTime = options.questSurviveStartTime;
        }
        game.screenManager.setScreen('playing');
    }
    game.updateUIVisibility(true);
}

export interface AdvanceToNextLevelContext {
    isDelve: boolean;
    delveFloor: number;
    transform: { x: number; y: number };
}

/**
 * In-place transition to the next level (portal "E = next area"): regenerate world, update bounds, reposition portal, change enemy level. Player is preserved.
 */
export function advanceToNextLevel(
    game: LevelTransitionGameRef,
    nextLevel: number,
    context: AdvanceToNextLevelContext
): void {
    const obstacleManager = game.systems.get('obstacles') as { clearWorld(): void; generateWorld(w: number, h: number, obstacles: unknown, exclusion: { x: number; y: number; radius: number }): void } | undefined;
    if (!obstacleManager) return;

    const worldConfig = GameConfig.world;
    const nextLevelConfig = GameConfig.levels && GameConfig.levels[nextLevel];
    // Delve: always underground, 1x1 scene tile only (old rules) — enforce on every floor advance
    const isDelve = context.isDelve || nextLevel === DELVE_LEVEL;
    let nextWorldWidth = (nextLevelConfig && nextLevelConfig.worldWidth != null) ? nextLevelConfig.worldWidth : worldConfig.width;
    let nextWorldHeight = (nextLevelConfig && nextLevelConfig.worldHeight != null) ? nextLevelConfig.worldHeight : worldConfig.height;
    let nextObstacles = nextLevelConfig && nextLevelConfig.obstacles;
    if (isDelve) {
        nextObstacles = DELVE_OBSTACLES_CONFIG;
        nextWorldWidth = 1200;
        nextWorldHeight = 1200;
    }

    if (context.isDelve) {
        game.playingState.delveFloor = (game.playingState.delveFloor || 0) + 1;
        game.playingState.lastEnemyKillX = null;
        game.playingState.lastEnemyKillY = null;
    }

    obstacleManager.clearWorld();
    obstacleManager.generateWorld(nextWorldWidth, nextWorldHeight, nextObstacles as Record<string, unknown>, {
        x: nextWorldWidth / 2,
        y: nextWorldHeight / 2,
        radius: 120
    });

    if (game.playingState.portal) {
        game.playingState.portal.x = nextWorldWidth / 2 - game.playingState.portal.width / 2;
        game.playingState.portal.y = nextWorldHeight / 2 - game.playingState.portal.height / 2;
    }

    game.setCurrentWorldSize(nextWorldWidth, nextWorldHeight);

    const cameraSystem = game.systems.get('camera') as { setWorldBounds?(w: number, h: number): void } | undefined;
    const pathfindingSystem = game.systems.get('pathfinding') as { setWorldBounds?(w: number, h: number): void } | undefined;
    if (cameraSystem?.setWorldBounds) cameraSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
    if (pathfindingSystem?.setWorldBounds) pathfindingSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);

    const enemyManager = game.systems.get('enemies') as { changeLevel(level: number, entities: unknown, obstacleManager: unknown, playerSpawn: { x: number; y: number }, options?: { delveFloor?: number }): void } | undefined;
    if (enemyManager) {
        const playerSpawnForLevel = { x: context.transform.x, y: context.transform.y };
        const opts = context.isDelve ? { delveFloor: game.playingState.delveFloor } : undefined;
        enemyManager.changeLevel(nextLevel, game.entities, obstacleManager, playerSpawnForLevel, opts);
    }

    if (nextLevel !== OGRE_DEN_LEVEL) {
        game.playingState.portalReturnLevel = null;
    }

    game.playingState.portalUseCooldown = 1.5;
}
