/**
 * Handles portal and hub (sanctuary) logic: cooldowns, E/B key, level transition, board/chest.
 */
import { GameConfig } from '../config/GameConfig.js';
import { getRandomQuestsForBoard, DELVE_LEVEL } from '../config/questConfig.js';
import { Utils } from '../utils/Utils.js';
import type { Quest } from '../types/quest.js';
import { Transform } from '../components/Transform.js';
import { Combat } from '../components/Combat.js';
import type { Entity } from '../entities/Entity.js';

export interface PlayingStateControllerContext {
    playingState: {
        portal: { x: number; y: number; width: number; height: number; spawned: boolean; hasNextLevel: boolean; targetLevel: number } | null;
        portalUseCooldown: number;
        playerNearPortal: boolean;
        portalChannelProgress: number;
        portalChannelAction: 'e' | 'b' | null;
        board: { x: number; y: number; width: number; height: number } | null;
        boardOpen: boolean;
        boardUseCooldown: number;
        playerNearBoard: boolean;
        playerNearQuestPortal: boolean;
        questPortalUseCooldown: number;
        questPortalChannelProgress: number;
        activeQuest: Quest | null;
        chest: { x: number; y: number; width: number; height: number } | null;
        chestOpen: boolean;
        chestUseCooldown: number;
        playerNearChest: boolean;
        shop: { x: number; y: number; width: number; height: number } | null;
        shopOpen: boolean;
        shopUseCooldown: number;
        shopScrollOffset: number;
        playerNearShop: boolean;
        crossbowReloadProgress: number;
        crossbowReloadInProgress: boolean;
        crossbowPerfectReloadNext: boolean;
        questList: { level: number; difficultyId: string; difficulty?: { goldMultiplier?: number }; seed?: number }[];
        hubSelectedQuestIndex: number;
        delveFloor: number;
        questCompleteFlairRemaining: number;
        questCompleteFlairTriggered?: boolean;
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
    clearPlayerInputsForMenu(): void;
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

        const enemyManager = g.systems.get('enemies') as { getCurrentLevel(): number; getEnemiesKilledThisLevel(): number; getAliveCount(): number; changeLevel(level: number, entities: unknown, obstacleManager: unknown, playerSpawn: { x: number; y: number } | null, options?: { delveFloor?: number }): void } | undefined;
        if (!enemyManager) {
            g.playingState.playerNearPortal = false;
            return;
        }

        const currentLevel = enemyManager.getCurrentLevel();
        const isDelve = currentLevel === DELVE_LEVEL;
        const levelConfig = GameConfig.levels && GameConfig.levels[currentLevel];
        const nextLevel = isDelve ? DELVE_LEVEL : currentLevel + 1;
        const nextLevelExists = isDelve || !!(GameConfig.levels && GameConfig.levels[currentLevel + 1]);
        const killsRequired = isDelve ? 999 : ((levelConfig && levelConfig.killsToUnlockPortal != null) ? levelConfig.killsToUnlockPortal : 999);
        const kills = enemyManager.getEnemiesKilledThisLevel();
        const allDead = isDelve && enemyManager.getAliveCount && enemyManager.getAliveCount() === 0;

        g.playingState.portal.targetLevel = nextLevel;
        g.playingState.portal.spawned = isDelve ? allDead : (kills >= killsRequired);
        // Delve: always allow descending (E = next floor, B = return to sanctuary). Other quests: complete = return only.
        const isDelveQuest = g.playingState.activeQuest?.questType === 'delve';
        g.playingState.portal.hasNextLevel = isDelveQuest ? nextLevelExists : (g.playingState.activeQuest ? false : nextLevelExists);

        // Quest complete flair: trigger once when portal spawns during a quest
        if (g.playingState.portal.spawned && g.playingState.activeQuest && !g.playingState.questCompleteFlairTriggered) {
            g.playingState.questCompleteFlairTriggered = true;
            g.playingState.questCompleteFlairRemaining = 2.5;
        }
        if (g.playingState.questCompleteFlairRemaining > 0) {
            g.playingState.questCompleteFlairRemaining = Math.max(0, g.playingState.questCompleteFlairRemaining - deltaTime);
        }

        // Delve: stairs spawn near last enemy kill
        if (isDelve && allDead && g.playingState.portal) {
            const w = (levelConfig && levelConfig.worldWidth != null) ? levelConfig.worldWidth : 1200;
            const h = (levelConfig && levelConfig.worldHeight != null) ? levelConfig.worldHeight : 1200;
            const cx = g.playingState.lastEnemyKillX ?? w / 2;
            const cy = g.playingState.lastEnemyKillY ?? h / 2;
            const halfW = g.playingState.portal.width / 2;
            const halfH = g.playingState.portal.height / 2;
            g.playingState.portal.x = Math.max(0, Math.min(w - g.playingState.portal.width, cx - halfW));
            g.playingState.portal.y = Math.max(0, Math.min(h - g.playingState.portal.height, cy - halfH));
        }

        if (!g.playingState.portal.spawned || !player) {
            g.playingState.playerNearPortal = false;
            g.playingState.portalChannelProgress = 0;
            g.playingState.portalChannelAction = null;
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

        if (!overlap) {
            g.playingState.portalChannelProgress = 0;
            g.playingState.portalChannelAction = null;
            return;
        }
        if (g.playingState.portalUseCooldown > 0) return;

        const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
        if (!inputSystem) return;

        const channelTime = (GameConfig.portal && (GameConfig.portal as { channelTime?: number }).channelTime != null)
            ? (GameConfig.portal as { channelTime: number }).channelTime
            : 1.2;

        const doReturnToSanctuary = () => {
            g.screenManager.selectedStartLevel = 0;
            g.startGame();
            g.playingState.portalUseCooldown = 1.5;
        };

        const doNextLevel = () => {
            const obstacleManager = g.systems.get('obstacles') as { clearWorld(): void; generateWorld(w: number, h: number, obstacles: unknown, exclusion: { x: number; y: number; radius: number }): void };
            const worldConfig = GameConfig.world;
            const nextLevelConfig = GameConfig.levels && GameConfig.levels[nextLevel];
            const nextWorldWidth = (nextLevelConfig && nextLevelConfig.worldWidth != null) ? nextLevelConfig.worldWidth : worldConfig.width;
            const nextWorldHeight = (nextLevelConfig && nextLevelConfig.worldHeight != null) ? nextLevelConfig.worldHeight : worldConfig.height;
            const nextObstacles = nextLevelConfig && nextLevelConfig.obstacles;
            if (isDelve) {
                g.playingState.delveFloor = (g.playingState.delveFloor || 0) + 1;
                g.playingState.lastEnemyKillX = null;
                g.playingState.lastEnemyKillY = null;
            }
            obstacleManager.clearWorld();
            obstacleManager.generateWorld(nextWorldWidth, nextWorldHeight, nextObstacles, {
                x: nextWorldWidth / 2,
                y: nextWorldHeight / 2,
                radius: 120
            });
            if (g.playingState.portal) {
                g.playingState.portal.x = nextWorldWidth / 2 - g.playingState.portal.width / 2;
                g.playingState.portal.y = nextWorldHeight / 2 - g.playingState.portal.height / 2;
            }
            g.setCurrentWorldSize(nextWorldWidth, nextWorldHeight);
            const cameraSystem = g.systems.get('camera') as { setWorldBounds?(w: number, h: number): void } | undefined;
            const pathfindingSystem = g.systems.get('pathfinding') as { setWorldBounds?(w: number, h: number): void } | undefined;
            if (cameraSystem && cameraSystem.setWorldBounds) cameraSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
            if (pathfindingSystem && pathfindingSystem.setWorldBounds) pathfindingSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
            const playerSpawnForLevel = { x: transform.x, y: transform.y };
            const opts = isDelve ? { delveFloor: g.playingState.delveFloor } : undefined;
            enemyManager.changeLevel(nextLevel, g.entities, obstacleManager, playerSpawnForLevel, opts);
            g.playingState.portalUseCooldown = 1.5;
        };

        // Portal interact key is E only: E = next area when available, else E = return to sanctuary
        if (g.playingState.portalChannelAction !== null) {
            if (!inputSystem.isKeyPressed('e')) {
                g.playingState.portalChannelProgress = 0;
                g.playingState.portalChannelAction = null;
                return;
            }
            g.playingState.portalChannelProgress = Math.min(1, g.playingState.portalChannelProgress + deltaTime / channelTime);
            if (g.playingState.portalChannelProgress >= 1) {
                const action = g.playingState.portalChannelAction;
                g.playingState.portalChannelProgress = 0;
                g.playingState.portalChannelAction = null;
                if (action === 'b') {
                    doReturnToSanctuary();
                } else {
                    doNextLevel();
                }
                return;
            }
            return;
        }

        if (inputSystem.isKeyPressed('e')) {
            const action = g.playingState.portal.hasNextLevel ? 'e' : 'b';
            g.playingState.portalChannelAction = action;
            g.playingState.portalChannelProgress = 0;
            if (channelTime <= 0) {
                if (action === 'b') doReturnToSanctuary();
                else doNextLevel();
                g.playingState.portalChannelAction = null;
            }
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
        if (g.playingState.shopUseCooldown > 0) {
            g.playingState.shopUseCooldown = Math.max(0, g.playingState.shopUseCooldown - deltaTime);
        }
        if (g.playingState.rerollStationUseCooldown > 0) {
            g.playingState.rerollStationUseCooldown = Math.max(0, g.playingState.rerollStationUseCooldown - deltaTime);
        }
        if (g.playingState.questPortalUseCooldown > 0) {
            g.playingState.questPortalUseCooldown = Math.max(0, g.playingState.questPortalUseCooldown - deltaTime);
        }
        if (g.playingState.boardOpen || g.playingState.chestOpen || g.playingState.shopOpen || g.playingState.rerollStationOpen) return;

        g.handleCameraZoom();

        const player = g.entities.get('player');
        if (player) {
            const combat = player.getComponent(Combat);
            const weapon = combat && (combat as Combat & { playerAttack?: { weapon?: { isRanged?: boolean; isBow?: boolean } } }).playerAttack ? (combat as Combat & { playerAttack: { weapon: { isRanged?: boolean; isBow?: boolean } } }).playerAttack.weapon : null;
            const isCrossbow = weapon && weapon.isRanged === true && !weapon.isBow;
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
                    g.playingState.questList = getRandomQuestsForBoard(3);
                    g.playingState.hubSelectedQuestIndex = Math.min(
                        g.playingState.hubSelectedQuestIndex,
                        Math.max(0, g.playingState.questList.length - 1)
                    );
                    g.playingState.boardOpen = true;
                    g.playingState.boardUseCooldown = 0.4;
                    g.clearPlayerInputsForMenu();
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
                    g.clearPlayerInputsForMenu();
                }
            } else {
                g.playingState.playerNearChest = false;
            }
        } else {
            g.playingState.playerNearChest = false;
        }
        if (player && g.playingState.shop) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    g.playingState.shop.x, g.playingState.shop.y, g.playingState.shop.width, g.playingState.shop.height
                );
                g.playingState.playerNearShop = overlap;
                if (overlap && g.playingState.shopUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    g.playingState.shopOpen = true;
                    g.playingState.shopUseCooldown = 0.4;
                    g.playingState.shopScrollOffset = 0;
                    g.playingState.shopExpandedWeapons = undefined;
                    g.playingState.shopExpandedArmor = undefined;
                    g.playingState.shopExpandedCategories = undefined;
                    g.clearPlayerInputsForMenu();
                }
            } else {
                g.playingState.playerNearShop = false;
            }
        } else {
            g.playingState.playerNearShop = false;
        }
        if (player && g.playingState.rerollStation) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    g.playingState.rerollStation.x, g.playingState.rerollStation.y, g.playingState.rerollStation.width, g.playingState.rerollStation.height
                );
                g.playingState.playerNearRerollStation = overlap;
                if (overlap && g.playingState.rerollStationUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    g.playingState.rerollStationOpen = true;
                    g.playingState.rerollStationUseCooldown = 0.4;
                    g.clearPlayerInputsForMenu();
                }
            } else {
                g.playingState.playerNearRerollStation = false;
            }
        } else {
            g.playingState.playerNearRerollStation = false;
        }
        // Quest portal in hub: when a quest is accepted, a portal spawns; hold E at portal to channel and start the quest
        const hubConfig = GameConfig.hub;
        const questPortalConfig = hubConfig && hubConfig.questPortal;
        const questChannelTime = (GameConfig.portal && (GameConfig.portal as { channelTime?: number }).channelTime) ?? 1.2;
        if (player && g.playingState.activeQuest && questPortalConfig) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    questPortalConfig.x, questPortalConfig.y, questPortalConfig.width, questPortalConfig.height
                );
                g.playingState.playerNearQuestPortal = overlap;
                if (!overlap) {
                    g.playingState.questPortalChannelProgress = 0;
                } else if (g.playingState.questPortalUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    g.playingState.questPortalChannelProgress = Math.min(1, g.playingState.questPortalChannelProgress + deltaTime / questChannelTime);
                    if (g.playingState.questPortalChannelProgress >= 1) {
                        g.screenManager.selectedStartLevel = g.playingState.activeQuest.level;
                        g.playingState.questPortalUseCooldown = 0.5;
                        g.playingState.questPortalChannelProgress = 0;
                        g.startGame();
                    }
                } else {
                    g.playingState.questPortalChannelProgress = 0;
                }
            } else {
                g.playingState.playerNearQuestPortal = false;
                g.playingState.questPortalChannelProgress = 0;
            }
        } else {
            g.playingState.playerNearQuestPortal = false;
            g.playingState.questPortalChannelProgress = 0;
        }
    }
}
