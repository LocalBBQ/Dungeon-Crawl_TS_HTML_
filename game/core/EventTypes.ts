// Centralized event name constants and payload types for the EventBus

export const EventTypes = {
  INPUT_KEYDOWN: 'input:keydown',
  INPUT_KEYUP: 'input:keyup',
  INPUT_MOUSEDOWN: 'input:mousedown',
  INPUT_MOUSEUP: 'input:mouseup',
  INPUT_RIGHTCLICK: 'input:rightclick',
  INPUT_RIGHTCLICK_UP: 'input:rightclickup',
  DAMAGE_TAKEN: 'damage:taken',
  PLAYER_HIT_ENEMY: 'combat:playerHitEnemy',
  PLAYER_KILLED_ENEMY: 'combat:playerKilledEnemy',
  PLAYER_DASH_ATTACK: 'combat:playerDashAttack',
} as const;

export type EventName = keyof typeof EventTypes;
export type EventTypeValue = (typeof EventTypes)[EventName];

/** Payload types per event. Used for typed on/emit. */
export interface DamageTakenPayload {
  x?: number;
  y?: number;
  amount?: number;
  damage?: number;
  isPlayerDamage?: boolean;
  isBlocked?: boolean;
  isParry?: boolean;
  entityId?: string;
}

export interface PlayerHitEnemyPayload {
  killed?: boolean;
}

export interface PlayerKilledEnemyPayload {
  x?: number;
  y?: number;
}

export type InputKeyPayload = string;
export interface InputPointerPayload {
  x: number;
  y: number;
}

/** Map event type key to payload type. PLAYER_DASH_ATTACK has no payload. */
export interface EventPayloadMap {
  [EventTypes.INPUT_KEYDOWN]: InputKeyPayload;
  [EventTypes.INPUT_KEYUP]: InputKeyPayload;
  [EventTypes.INPUT_MOUSEDOWN]: InputPointerPayload;
  [EventTypes.INPUT_MOUSEUP]: InputPointerPayload;
  [EventTypes.INPUT_RIGHTCLICK]: InputPointerPayload;
  [EventTypes.INPUT_RIGHTCLICK_UP]: InputPointerPayload;
  [EventTypes.DAMAGE_TAKEN]: DamageTakenPayload;
  [EventTypes.PLAYER_HIT_ENEMY]: PlayerHitEnemyPayload;
  [EventTypes.PLAYER_KILLED_ENEMY]: PlayerKilledEnemyPayload;
  [EventTypes.PLAYER_DASH_ATTACK]: null;
}

if (typeof window !== 'undefined') {
  (window as unknown as { EventTypes: typeof EventTypes }).EventTypes = EventTypes;
}
