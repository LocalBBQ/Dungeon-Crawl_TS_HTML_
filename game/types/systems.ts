/**
 * Systems map: name -> system/manager instance. Used by Game and entity updates.
 */
export interface SystemsMap {
  get(name: string): unknown;
  eventBus?: { emit(event: string, payload?: unknown): void };
}
