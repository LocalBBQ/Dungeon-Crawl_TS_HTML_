// Event Bus for decoupled communication
import type { EventPayloadMap } from './EventTypes.ts';

export class EventBus {
  private listeners = new Map<string, ((data: unknown) => void)[]>();

  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /** Typed subscribe: callback receives the payload type for this event. */
  onTyped<K extends keyof EventPayloadMap>(
    event: K,
    callback: (data: EventPayloadMap[K]) => void
  ): void {
    this.on(event, callback as (data: unknown) => void);
  }

  off(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event: string, data: unknown = null): void {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event)!.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /** Typed emit: data must match the payload type for this event. */
  emitTyped<K extends keyof EventPayloadMap>(event: K, data: EventPayloadMap[K]): void {
    this.emit(event, data);
  }

  once(event: string, callback: (data: unknown) => void): void {
    const wrapper = (data: unknown) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  clear(): void {
    this.listeners.clear();
  }
}
