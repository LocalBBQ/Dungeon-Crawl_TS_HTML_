// Centralized event name constants for the EventBus

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

if (typeof window !== 'undefined') {
  (window as unknown as { EventTypes: typeof EventTypes }).EventTypes = EventTypes;
}
