/**
 * Handles portal and hub (sanctuary) logic: cooldowns, E/B key, level transition, board/chest.
 */
import { GameConfig } from '../config/GameConfig.js';
import { Utils } from '../utils/Utils.js';
import { Transform } from '../components/Transform.js';
import { Combat } from '../components/Combat.js';
import type { Entity } from '../entities/Entity.js';

export interface PlayingStateControllerContext {
    playingState: {
        portal: { x: number; y: number; width: number; height: number; spawned: boolean; hasNextLevel: boolean; targetLevel: number } | null;
        portalUseCooldown: number;
        playerNearPortal: boolean;
        board: { x: number; y: number; width: number; height: number } | null;
        boardOpen: boolean;
        boardUseCooldown: number;
        playerNearBoard: boolean;
        chest: { x: number; y: number; width: number; height: number } | null;
        chestOpen: boolean;
        chestUseCooldown: number;
        playerNearChest: boolean;
        crossbowReloadProgress: number;
        crossbowReloadInProgress: boolean;
        crossbowPerfectReloadNext: boolean;
    };
    systems: {
        get(name: string): unknown;
    };
    entities: { get(id: string): Entity | undefined };
    canvas: HTMLCanvasElement;
    screenManager: {
        selectedStartLevel: number;
        setScreen(screen: string): void;
    };
    setCurrentWorldSize(width: number, height: number): void;
    startGame(): void;
    handleCameraZoom(): void;
}

export class PlayingStateController {
    private game: PlayingStateControllerContext;

    constructor(game: PlayingStateControllerContext) {
        this.game = game;
    }

    updatePortal(deltaTime: number, player: Entity | undefined) {
        const g = this.game;
        if (!g.playingState.portal) return;

        if (g.playingState.portalUseCooldown > 0) {
            g.playingState.portalUseCooldown = Math.max(0, g.playingState.portalUseCooldown - deltaTime);
        }

        const enemyManager = g.systems.get('enemies') as { getCurrentLevel(): number; getEnemiesKilledThisLevel(): number; changeLevel(level: number, entities: unknown, obstacleManager: unknown, playerSpawn: { x: number; y: number } | null): void } | undefined;
        if (!enemyManager) {
            g.playingState.playerNearPortal = false;
            return;
        }

        const currentLevel = enemyManager.getCurrentLevel();
        const levelConfig = GameConfig.levels && GameConfig.levels[currentLevel];
        const nextLevel = currentLevel + 1;
        const nextLevelExists = !!(GameConfig.levels && GameConfig.levels[nextLevel]);
        const killsRequired = (levelConfig && levelConfig.killsToUnlockPortal != null) ? levelConfig.killsToUnlockPortal : 999;
        const kills = enemyManager.getEnemiesKilledThisLevel();

        g.playingState.portal.targetLevel = nextLevel;
        g.playingState.portal.spawned = kills >= killsRequired;
        g.playingState.portal.hasNextLevel = !!nextLevelExists;

        if (!g.playingState.portal.spawned || !player) {
            g.playingState.playerNearPortal = false;
            return;
        }

        const transform = player.getComponent(Transform);
        if (!transform) {
            g.playingState.playerNearPortal = false;
            return;
        }

        const overlap = Utils.rectCollision(
            transform.left, transform.top, transform.width, transform.height,
            g.playingState.portal.x, g.playingState.portal.y, g.playingState.portal.width, g.playingState.portal.height
        );
        g.playingState.playerNearPortal = overlap;

        if (!overlap || g.playingState.portalUseCooldown > 0) return;

        const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
        if (!inputSystem) return;

        if (inputSystem.isKeyPressed('b')) {
            g.screenManager.selectedStartLevel = 0;
            g.startGame();
            g.playingState.portalUseCooldown = 1.5;
            return;
        }

        if (inputSystem.isKeyPressed('e') && nextLevelExists) {
            const obstacleManager = g.systems.get('obstacles') as { clearWorld(): void; generateWorld(w: number, h: number, obstacles: unknown, exclusion: { x: number; y: number; radius: number }): void };
            const worldConfig = GameConfig.world;
            const nextLevelConfig = GameConfig.levels && GameConfig.levels[nextLevel];
            const nextWorldWidth = (nextLevelConfig && nextLevelConfig.worldWidth != null) ? nextLevelConfig.worldWidth : worldConfig.width;
            const nextWorldHeight = (nextLevelConfig && nextLevelConfig.worldHeight != null) ? nextLevelConfig.worldHeight : worldConfig.height;
            const nextObstacles = nextLevelConfig && nextLevelConfig.obstacles;
            obstacleManager.clearWorld();
            obstacleManager.generateWorld(nextWorldWidth, nextWorldHeight, nextObstacles, {
                x: g.playingState.portal.x + g.playingState.portal.width / 2,
                y: g.playingState.portal.y + g.playingState.portal.height / 2,
                radius: 120
            });
            g.setCurrentWorldSize(nextWorldWidth, nextWorldHeight);
            const cameraSystem = g.systems.get('camera') as { setWorldBounds?(w: number, h: number): void } | undefined;
            const pathfindingSystem = g.systems.get('pathfinding') as { setWorldBounds?(w: number, h: number): void } | undefined;
            if (cameraSystem && cameraSystem.setWorldBounds) cameraSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
            if (pathfindingSystem && pathfindingSystem.setWorldBounds) pathfindingSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
            const playerSpawnForLevel = { x: transform.x, y: transform.y };
            enemyManager.changeLevel(nextLevel, g.entities, obstacleManager, playerSpawnForLevel);
            g.playingState.portalUseCooldown = 1.5;
        }
    }

    updateHub(deltaTime: number) {
        const g = this.game;
        if (g.playingState.boardUseCooldown > 0) {
            g.playingState.boardUseCooldown = Math.max(0, g.playingState.boardUseCooldown - deltaTime);
        }
        if (g.playingState.chestUseCooldown > 0) {
            g.playingState.chestUseCooldown = Math.max(0, g.playingState.chestUseCooldown - deltaTime);
        }
        if (g.playingState.boardOpen || g.playingState.chestOpen) return;

        g.handleCameraZoom();

        const player = g.entities.get('player');
        if (player) {
            const combat = player.getComponent(Combat);
            const weapon = combat && (combat as Combat & { playerAttack?: { weapon?: { isRanged?: boolean } } }).playerAttack ? (combat as Combat & { playerAttack: { weapon: { isRanged?: boolean } } }).playerAttack.weapon : null;
            const isCrossbow = weapon && weapon.isRanged === true;
            const crossbowConfig = GameConfig.player && (GameConfig.player as { crossbow?: { reloadTime: number } }).crossbow;
            if (isCrossbow && crossbowConfig && g.playingState.crossbowReloadInProgress && g.playingState.crossbowReloadProgress < 1) {
                g.playingState.crossbowReloadProgress = Math.min(1, g.playingState.crossbowReloadProgress + deltaTime / crossbowConfig.reloadTime);
                if (g.playingState.crossbowReloadProgress >= 1) g.playingState.crossbowReloadInProgress = false;
            }
            if (combat && !isCrossbow) {
                g.playingState.crossbowReloadProgress = 1;
                g.playingState.crossbowReloadInProgress = false;
                g.playingState.crossbowPerfectReloadNext = false;
            }
            if (isCrossbow) {
                (player as Entity & { crossbowReloadProgress: number; crossbowReloadInProgress: boolean }).crossbowReloadProgress = g.playingState.crossbowReloadProgress;
                (player as Entity & { crossbowReloadProgress: number; crossbowReloadInProgress: boolean }).crossbowReloadInProgress = g.playingState.crossbowReloadInProgress;
            }
        }

        const systems = g.systems as { update(dt: number): void };
        systems.update(deltaTime);

        const cameraSystem = g.systems.get('camera') as { follow(transform: unknown, w: number, h: number): void } | undefined;
        const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
        if (player) {
            const transform = player.getComponent(Transform);
            if (transform && cameraSystem) {
                cameraSystem.follow(transform, g.canvas.width, g.canvas.height);
            }
        }
        if (player && g.playingState.board) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    g.playingState.board.x, g.playingState.board.y, g.playingState.board.width, g.playingState.board.height
                );
                g.playingState.playerNearBoard = overlap;
                if (overlap && g.playingState.boardUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    g.playingState.boardOpen = true;
                    g.playingState.boardUseCooldown = 0.4;
                }
            } else {
                g.playingState.playerNearBoard = false;
            }
        } else {
            g.playingState.playerNearBoard = false;
        }
        if (player && g.playingState.chest) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    g.playingState.chest.x, g.playingState.chest.y, g.playingState.chest.width, g.playingState.chest.height
                );
                g.playingState.playerNearChest = overlap;
                if (overlap && g.playingState.chestUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    g.playingState.chestOpen = true;
                    g.playingState.chestUseCooldown = 0.4;
                }
            } else {
                g.playingState.playerNearChest = false;
            }
        } else {
            g.playingState.playerNearChest = false;
        }
    }
}
