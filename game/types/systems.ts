import type { GameConfigShape } from './config.js';
import type { EntityManager } from '../managers/EntityManager.js';
import type { SpriteManager } from '../managers/SpriteManager.js';
import type { InputSystem } from '../systems/InputSystem.js';
import type { CameraSystem } from '../systems/CameraSystem.js';
import type { CollisionSystem } from '../systems/CollisionSystem.js';
import type { ObstacleManager } from '../managers/ObstacleManager.js';
import type { GatherableManager } from '../managers/GatherableManager.js';
import type { PathfindingSystem } from '../systems/PathfindingSystem.js';
import type { EnemyManager } from '../managers/EnemyManager.js';
import type { HazardManager } from '../managers/HazardManager.js';
import type { DamageNumberManager } from '../managers/DamageNumberManager.js';
import type { ProjectileManager } from '../managers/ProjectileManager.js';
import type { PickupManager } from '../managers/PickupManager.js';
import type { RenderSystem } from '../systems/RenderSystem.js';
import type { PlayingState } from '../state/PlayingState.js';

/**
 * Systems map: name -> system/manager instance. Used by Game and entity updates.
 */
export interface SystemsMap {
  get(name: string): unknown;
  eventBus?: { emit(event: string, payload?: unknown): void };
}

/**
 * Typed access to all registered systems. Use getTyped() on SystemManager for type-safe access.
 */
export interface GameSystems {
  config: GameConfigShape;
  playingState: PlayingState;
  entities: EntityManager;
  sprites: SpriteManager;
  input: InputSystem;
  camera: CameraSystem;
  collision: CollisionSystem;
  obstacles: ObstacleManager;
  gatherables: GatherableManager;
  pathfinding: PathfindingSystem;
  enemies: EnemyManager;
  hazards: HazardManager;
  damageNumbers: DamageNumberManager;
  projectiles: ProjectileManager;
  pickups: PickupManager;
  render: RenderSystem;
}
