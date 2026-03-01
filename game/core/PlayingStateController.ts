/**
 * Handles portal and hub (sanctuary) logic: cooldowns, E/B key, level transition, board/chest.
 */
import { GameConfig } from '../config/GameConfig.js';
import { getRandomQuestsForBoard, DELVE_LEVEL, DRAGON_ARENA_LEVEL, OGRE_DEN_LEVEL } from '../config/questConfig.js';
import { isStaticQuestComplete } from '../config/staticQuests.js';
import { advanceToNextLevel, type LevelTransitionGameRef } from './LevelTransition.js';
import { Utils } from '../utils/Utils.js';
import type { Quest } from '../types/quest.js';
import type { PlayingStateShape } from '../state/PlayingState.js';
import { Transform } from '../components/Transform.js';
import { Combat } from '../components/Combat.js';
import type { EntityShape } from '../types/entity.js';
import { updateCrossbowReload } from '../utils/crossbowReload.js';

export interface PlayingStateControllerContext {
    playingState: PlayingStateShape;
    systems: {
        get(name: string): unknown;
        update?(dt: number): void;
    };
    entities: { get(id: string): EntityShape | undefined };
    canvas: HTMLCanvasElement;
    screenManager: {
        selectedStartLevel: number;
        setScreen(screen: string): void;
    };
    setCurrentWorldSize(width: number, height: number): void;
    getCurrentWorldSize(): { width: number; height: number };
    startGame(): void;
    recallToSanctuaryForfeitInventory(): void;
    handleCameraZoom(): void;
    clearPlayerInputsForMenu(): void;
}

export class PlayingStateController {
    private game: PlayingStateControllerContext;

    constructor(game: PlayingStateControllerContext) {
        this.game = game;
    }

    updatePortal(deltaTime: number, player: EntityShape | undefined) {
        const g = this.game;
        if (!g.playingState.portal) {
            g.playingState.playerNearPortal = false;
            return;
        }

        if (g.playingState.portalUseCooldown > 0) {
            g.playingState.portalUseCooldown = Math.max(0, g.playingState.portalUseCooldown - deltaTime);
        }

        const enemyManager = g.systems.get('enemies') as { getCurrentLevel(): number; getEnemiesKilledThisLevel(): number; getKillsByTypeThisLevel?(): Record<string, number>; getAliveCount?(): number; changeLevel(level: number, entities: unknown, obstacleManager: unknown, playerSpawn: { x: number; y: number } | null, options?: { delveFloor?: number }): void } | undefined;
        if (!enemyManager) {
            g.playingState.playerNearPortal = false;
            return;
        }

        const currentLevel = enemyManager.getCurrentLevel();
        const transform = player?.getComponent(Transform);
        const obstacleManager = g.systems.get('obstacles') as { obstacles: { type: string; x: number; y: number; width: number; height: number; targetLevel?: number; returnLevel?: number }[] } | undefined;
        let caveEntranceOverlap: { targetLevel: number; returnLevel: number; x: number; y: number; width: number; height: number } | null = null;
        if (transform && obstacleManager?.obstacles) {
            for (const obs of obstacleManager.obstacles) {
                if (obs.type !== 'caveEntrance' || obs.targetLevel == null) continue;
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    obs.x, obs.y, obs.width, obs.height
                );
                if (overlap) {
                    caveEntranceOverlap = { targetLevel: obs.targetLevel, returnLevel: obs.returnLevel ?? 1, x: obs.x, y: obs.y, width: obs.width, height: obs.height };
                    break;
                }
            }
        }
        g.playingState.playerNearCaveEntrance = caveEntranceOverlap != null;
        g.playingState.caveEntranceRect = caveEntranceOverlap ? { x: caveEntranceOverlap.x, y: caveEntranceOverlap.y, width: caveEntranceOverlap.width, height: caveEntranceOverlap.height } : null;
        if (!caveEntranceOverlap) {
            g.playingState.caveEntranceChannelProgress = 0;
        } else {
            const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
            const channelTime = (GameConfig.portal && (GameConfig.portal as { channelTime?: number }).channelTime != null) ? (GameConfig.portal as { channelTime: number }).channelTime : 1.2;
            if (inputSystem?.isKeyPressed('e')) {
                g.playingState.caveEntranceChannelProgress = Math.min(1, g.playingState.caveEntranceChannelProgress + deltaTime / channelTime);
                if (g.playingState.caveEntranceChannelProgress >= 1) {
                    g.playingState.portalReturnLevel = caveEntranceOverlap.returnLevel;
                    // Serialize current level map so we can restore it when leaving the cave (e.g. ogre den).
                    const returnLevel = caveEntranceOverlap.returnLevel ?? 1;
                    const obsMgr = g.systems.get('obstacles') as { serializeWorld(): { x: number; y: number; width: number; height: number; type: string; spritePath?: string | null; spriteFrameIndex?: number; breakable?: boolean; hp?: number; maxHp?: number; passable?: boolean; targetLevel?: number; returnLevel?: number }[] } | undefined;
                    const worldSize = g.getCurrentWorldSize();
                    if (obsMgr?.serializeWorld) {
                        g.playingState.serializedReturnLevelMap = {
                            levelId: returnLevel,
                            worldWidth: worldSize.width,
                            worldHeight: worldSize.height,
                            obstacles: obsMgr.serializeWorld()
                        };
                    }
                    g.screenManager.selectedStartLevel = caveEntranceOverlap.targetLevel;
                    // Do not set activeQuest here: ogre is only the quest objective when the player chose "The Ogre's Den" from the hub. Entering the cave from outskirts is a random encounter; keep current quest (or null).
                    g.startGame();
                    g.playingState.caveEntranceChannelProgress = 0;
                    return;
                }
            } else {
                g.playingState.caveEntranceChannelProgress = 0;
            }
        }

        // Cave exit: only available in Ogre's Den after the ogre is killed; exit is spawned on the perimeter when ogre dies
        if (currentLevel !== OGRE_DEN_LEVEL) {
            g.playingState.ogreDenExitSpawned = false;
        }
        let caveExitOverlap: { x: number; y: number; width: number; height: number } | null = null;
        if (currentLevel === OGRE_DEN_LEVEL && transform && obstacleManager?.obstacles) {
            const aliveCount = enemyManager.getAliveCount?.() ?? 1;
            if (aliveCount === 0) {
                if (!g.playingState.ogreDenExitSpawned) {
                    const levelConfig = GameConfig.levels && GameConfig.levels[OGRE_DEN_LEVEL] as { worldWidth?: number; worldHeight?: number } | undefined;
                    const worldW = levelConfig?.worldWidth ?? 1200;
                    const worldH = levelConfig?.worldHeight ?? 1200;
                    const exitW = 160;
                    const exitH = 80;
                    const perimeterMargin = 24;
                    const obsMgr = g.systems.get('obstacles') as { addObstacle(x: number, y: number, w: number, h: number, type: string, spritePath?: string | null, customProps?: Record<string, unknown> | null): unknown } | undefined;
                    if (obsMgr?.addObstacle) {
                        const exitX = (worldW - exitW) / 2;
                        const exitY = perimeterMargin;
                        obsMgr.addObstacle(exitX, exitY, exitW, exitH, 'caveExit', null, { passable: true });
                        g.playingState.ogreDenExitSpawned = true;
                    }
                }
                for (const obs of obstacleManager.obstacles) {
                    if (obs.type !== 'caveExit') continue;
                    const overlap = Utils.rectCollision(
                        transform.left, transform.top, transform.width, transform.height,
                        obs.x, obs.y, obs.width, obs.height
                    );
                    if (overlap) {
                        caveExitOverlap = { x: obs.x, y: obs.y, width: obs.width, height: obs.height };
                        break;
                    }
                }
            }
        }
        g.playingState.playerNearCaveExit = caveExitOverlap != null;
        g.playingState.caveExitRect = caveExitOverlap;
        if (caveExitOverlap) {
            const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
            if (inputSystem?.isKeyPressed('e')) {
                const returnLevel = g.playingState.portalReturnLevel ?? 1;
                g.screenManager.selectedStartLevel = returnLevel;
                g.startGame();
                return;
            }
        }

        const isDelve = currentLevel === DELVE_LEVEL;
        const isDragonArena = currentLevel === DRAGON_ARENA_LEVEL;
        const isOgreDen = currentLevel === OGRE_DEN_LEVEL;
        const levelConfig = GameConfig.levels && GameConfig.levels[currentLevel];
        const nextLevel = isDelve ? DELVE_LEVEL
            : isDragonArena ? 0
            : isOgreDen ? (g.playingState.portalReturnLevel ?? 0)
            : currentLevel + 1;
        const nextLevelExists = isDelve || isDragonArena || isOgreDen || !!(GameConfig.levels && GameConfig.levels[currentLevel + 1]);
        const kills = enemyManager.getEnemiesKilledThisLevel();
        const allDead = isDelve && enemyManager.getAliveCount && enemyManager.getAliveCount() === 0;

        let portalSpawned: boolean;
        const activeQuest = g.playingState.activeQuest;
        if (activeQuest?.objectiveType) {
            const gatherableManager = g.systems.get('gatherables') as { getCollectedCount?(type: string): number } | undefined;
            portalSpawned = isStaticQuestComplete(activeQuest, {
                    getEnemiesKilledThisLevel: () => enemyManager.getEnemiesKilledThisLevel(),
                    getKillsByTypeThisLevel: enemyManager.getKillsByTypeThisLevel ? () => enemyManager.getKillsByTypeThisLevel!() : undefined,
                    getAliveCount: enemyManager.getAliveCount ? () => enemyManager.getAliveCount!() : undefined,
                    getCollectedCount: gatherableManager?.getCollectedCount?.bind(gatherableManager),
                    questSurviveStartTime: g.playingState.questSurviveStartTime,
                    levelConfig: levelConfig as { bossSpawn?: { type: string } } | undefined,
                    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000,
                });
        } else {
            const killsRequired = isDelve ? 999 : ((levelConfig && levelConfig.killsToUnlockPortal != null) ? levelConfig.killsToUnlockPortal : 999);
            portalSpawned = isDelve ? allDead : (kills >= killsRequired);
        }

        g.playingState.portal.targetLevel = nextLevel;
        g.playingState.portal.spawned = portalSpawned;
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

        const playerTransform = player.getComponent(Transform);
        if (!playerTransform) {
            g.playingState.playerNearPortal = false;
            return;
        }

        const overlap = Utils.rectCollision(
            playerTransform.left, playerTransform.top, playerTransform.width, playerTransform.height,
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
            advanceToNextLevel(g as unknown as LevelTransitionGameRef, nextLevel, {
                isDelve,
                delveFloor: g.playingState.delveFloor,
                transform: { x: transform.x, y: transform.y }
            });
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

    /** When in a level: hold B (and not at recall portal) for 2.5s to spawn a blue recall portal; E at it returns to Sanctuary and keeps inventory. */
    updateRecallChannel(deltaTime: number) {
        const g = this.game;
        if (g.playingState.recallPortal?.spawned) return;
        if (g.playingState.portal && g.playingState.playerNearPortal) return;
        const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
        if (!inputSystem) return;
        const channelTime = 2.5;
        if (!inputSystem.isKeyPressed('b')) {
            g.playingState.recallChannelProgress = 0;
            return;
        }
        g.playingState.recallChannelProgress = Math.min(1, g.playingState.recallChannelProgress + deltaTime / channelTime);
        if (g.playingState.recallChannelProgress >= 1) {
            g.playingState.recallChannelProgress = 0;
            const { width: worldW, height: worldH } = g.getCurrentWorldSize();
            const pw = 80;
            const ph = 80;
            let rx: number, ry: number;
            if (g.playingState.portal) {
                rx = g.playingState.portal.x + (g.playingState.portal.width - pw) / 2;
                ry = g.playingState.portal.y + (g.playingState.portal.height - ph) / 2;
                rx = Math.max(0, Math.min(worldW - pw, rx));
                ry = Math.max(0, Math.min(worldH - ph, ry));
            } else {
                rx = worldW / 2 - pw / 2;
                ry = worldH / 2 - ph / 2;
            }
            g.playingState.recallPortal = { x: rx, y: ry, width: pw, height: ph, spawned: true };
        }
    }

    /** When recall portal is spawned: check overlap and E channel; on complete return to Sanctuary (keeps inventory). */
    updateRecallPortal(deltaTime: number) {
        const g = this.game;
        const rp = g.playingState.recallPortal;
        if (!rp?.spawned) return;
        const player = g.entities.get('player');
        const playerTransform = player?.getComponent(Transform);
        if (!playerTransform) {
            g.playingState.playerNearRecallPortal = false;
            g.playingState.recallPortalChannelProgress = 0;
            return;
        }
        const overlap = Utils.rectCollision(
            playerTransform.left, playerTransform.top, playerTransform.width, playerTransform.height,
            rp.x, rp.y, rp.width, rp.height
        );
        g.playingState.playerNearRecallPortal = overlap;
        const inputSystem = g.systems.get('input') as { isKeyPressed(key: string): boolean } | undefined;
        if (!inputSystem) return;
        const channelTime = (GameConfig.portal && (GameConfig.portal as { channelTime?: number }).channelTime != null)
            ? (GameConfig.portal as { channelTime: number }).channelTime
            : 1.2;
        if (!overlap) {
            g.playingState.recallPortalChannelProgress = 0;
            return;
        }
        if (!inputSystem.isKeyPressed('e')) {
            g.playingState.recallPortalChannelProgress = 0;
            return;
        }
        g.playingState.recallPortalChannelProgress = Math.min(1, g.playingState.recallPortalChannelProgress + deltaTime / channelTime);
        if (g.playingState.recallPortalChannelProgress >= 1) {
            g.playingState.recallPortal = null;
            g.playingState.recallPortalChannelProgress = 0;
            g.playingState.returnedViaBlueRecall = true;
            g.screenManager.selectedStartLevel = 0;
            g.startGame();
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
            const weapon = combat && (combat as Combat & { playerAttack?: { weapon?: { isRanged?: boolean; isBow?: boolean; isStaff?: boolean } } }).playerAttack ? (combat as Combat & { playerAttack: { weapon: { isRanged?: boolean; isBow?: boolean; isStaff?: boolean } } }).playerAttack.weapon : null;
            const isCrossbow = !!(weapon && weapon.isRanged === true && !weapon.isBow && !weapon.isStaff);
            updateCrossbowReload(deltaTime, g.playingState, player, GameConfig as { player: { crossbow?: { reloadTime: number } } }, isCrossbow);
        }

        g.systems.update?.(deltaTime);

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
        // Reenter portal in hub: blue portal to re-enter the quest that was just left
        const hubConfig = GameConfig.hub as { questPortal?: { x: number; y: number; width: number; height: number }; reenterPortal?: { x: number; y: number; width: number; height: number } };
        const reenterPortalConfig = hubConfig && hubConfig.reenterPortal;
        const questChannelTime = (GameConfig.portal && (GameConfig.portal as { channelTime?: number }).channelTime) ?? 1.2;
        if (player && g.playingState.hubReenterLevel != null && reenterPortalConfig) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    reenterPortalConfig.x, reenterPortalConfig.y, reenterPortalConfig.width, reenterPortalConfig.height
                );
                g.playingState.playerNearReenterPortal = overlap;
                if (!overlap) {
                    g.playingState.reenterPortalChannelProgress = 0;
                } else if (inputSystem && inputSystem.isKeyPressed('e')) {
                    g.playingState.reenterPortalChannelProgress = Math.min(1, g.playingState.reenterPortalChannelProgress + deltaTime / questChannelTime);
                    if (g.playingState.reenterPortalChannelProgress >= 1) {
                        g.playingState.activeQuest = g.playingState.hubReenterQuest;
                        g.screenManager.selectedStartLevel = g.playingState.hubReenterLevel;
                        if (g.playingState.hubReenterQuest?.questType === 'delve') {
                            g.playingState.delveFloor = g.playingState.hubReenterDelveFloor;
                        }
                        g.playingState.hubReenterLevel = null;
                        g.playingState.hubReenterQuest = null;
                        g.playingState.hubReenterDelveFloor = 0;
                        g.playingState.reenterPortalChannelProgress = 0;
                        g.startGame();
                    }
                } else {
                    g.playingState.reenterPortalChannelProgress = 0;
                }
            } else {
                g.playingState.playerNearReenterPortal = false;
                g.playingState.reenterPortalChannelProgress = 0;
            }
        } else {
            g.playingState.playerNearReenterPortal = false;
            g.playingState.reenterPortalChannelProgress = 0;
        }

        // Quest portal in hub: when a quest is accepted, a portal spawns; hold E at portal to channel and start the quest
        const questPortalConfig = hubConfig && hubConfig.questPortal;
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
