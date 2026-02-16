/** Event names used by EventBus. */
export type EventName =
  | 'input:keydown'
  | 'input:keyup'
  | 'input:mousedown'
  | 'input:mouseup'
  | 'input:rightclick'
  | 'input:rightclickup'
  | 'damage:taken'
  | 'combat:playerHitEnemy'
  | 'combat:playerKilledEnemy'
  | 'combat:playerDashAttack';
