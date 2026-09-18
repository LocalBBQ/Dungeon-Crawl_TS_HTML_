// Input System
import { EventTypes } from '../core/EventTypes.js';
import type { SystemManager } from '../core/SystemManager.js';

export class InputSystem {
  canvas: HTMLCanvasElement;
  keys: Record<string, boolean>;
  /** Physical keydowns this frame (no `repeat`); consumed by gameplay for tap-to-start channels. */
  private keysJustPressed: Set<string> = new Set();
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  mouseClicked: boolean;
  rightMouseDown: boolean;
  rightMouseClicked: boolean;
  middleMouseDown: boolean;
  wheelDelta: number;
  /** Middle-drag movement in canvas pixels, accumulated until the camera consumes it. */
  private orbitDragX = 0;
  private orbitDragY = 0;
  /** Distance travelled during the current middle-press, used to tell a click from a drag. */
  private middleDragDistance = 0;
  private orbitResetRequested = false;
  systems: SystemManager | null;
  chargeStartTime: number;
  isCharging: boolean;
  /** When set, left mousedown only starts charge if this returns false (e.g. pointer not on UI/drag). */
  getPointerDownConsumedByUI: (() => boolean) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.rightMouseDown = false;
    this.rightMouseClicked = false;
    this.middleMouseDown = false;
    this.wheelDelta = 0;
    this.systems = null;
    this.chargeStartTime = 0;
    this.isCharging = false;
  }

  init(systems: SystemManager): void {
    this.systems = systems;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Note: Ctrl+key is often handled by the browser before keydown reaches the page, so we cannot
    // reliably prevent or use it. Use Alt+key or Shift+key for game bindings (e.g. Alt+1); check
    // isAltPressed() / isKeyPressed('shift') for modifier state.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (this.systems?.eventBus) {
          this.systems.eventBus.emit(EventTypes.INPUT_KEYDOWN, 'tab');
        }
        return;
      }
      const isBareModifier = e.key === 'Control' || e.key === 'Meta';
      if (isBareModifier) {
        e.preventDefault();
        return;
      }
      e.preventDefault(); // block browser shortcuts where we can (Alt+key, etc.)
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (!e.repeat) {
        this.keysJustPressed.add(k);
      }
      this.systems!.eventBus.emit(EventTypes.INPUT_KEYDOWN, k);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }
      const isBareModifier = e.key === 'Control' || e.key === 'Meta';
      if (isBareModifier) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      this.keys[e.key.toLowerCase()] = false;
      this.systems!.eventBus.emit(EventTypes.INPUT_KEYUP, e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (this.middleMouseDown) {
        const dx = x - this.mouseX;
        const dy = y - this.mouseY;
        this.orbitDragX += dx;
        this.orbitDragY += dy;
        this.middleDragDistance += Math.hypot(dx, dy);
      }
      this.mouseX = x;
      this.mouseY = y;
    });

    this.canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
    // Middle click otherwise starts the browser's autoscroll, which steals the drag.
    this.canvas.addEventListener('auxclick', (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    });

    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        this.middleMouseDown = true;
        this.middleDragDistance = 0;
        return;
      }
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        // Do not build charge when pointer down was consumed by UI (e.g. clicking/dragging inventory, chest, shop)
        const consumedByUI = this.getPointerDownConsumedByUI?.() === true;
        if (!consumedByUI) {
          this.isCharging = true;
          this.chargeStartTime = performance.now();
        }
        this.systems!.eventBus.emit(EventTypes.INPUT_MOUSEDOWN, {
          x: this.mouseX,
          y: this.mouseY,
          shiftKey: e.shiftKey,
        });
      } else if (e.button === 2) {
        this.rightMouseDown = true;
        this.rightMouseClicked = true;
        this.systems!.eventBus.emit(EventTypes.INPUT_RIGHTCLICK, { x: this.mouseX, y: this.mouseY });
      }
    });

    this.canvas.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this._emitLeftMouseUp(e.shiftKey);
      } else if (e.button === 2) {
        this.rightMouseDown = false;
        this.systems!.eventBus.emit(EventTypes.INPUT_RIGHTCLICK_UP, { x: this.mouseX, y: this.mouseY });
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      // Bound to the window so a drag that ends off the canvas still releases.
      if (e.button === 1) {
        // A middle press that barely moved was a click, which recentres the camera.
        if (this.middleMouseDown && this.middleDragDistance < 4) this.orbitResetRequested = true;
        this.middleMouseDown = false;
      }
      if (e.button === 0 && this.isCharging) {
        this._emitLeftMouseUp(e.shiftKey);
      }
    });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.wheelDelta = e.deltaY;
    });
  }

  isKeyPressed(key: string): boolean {
    return !!this.keys[key.toLowerCase()];
  }

  /**
   * WASD as a world-space direction. The keys are screen-relative, so when the 3D camera has been
   * orbited the raw axes are turned by the view's yaw before gameplay treats them as world offsets.
   * Not normalized: callers combine it with other directions before deciding on a speed.
   */
  getMoveAxis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isKeyPressed('w')) y -= 1;
    if (this.isKeyPressed('s')) y += 1;
    if (this.isKeyPressed('a')) x -= 1;
    if (this.isKeyPressed('d')) x += 1;
    if (x === 0 && y === 0) return { x, y };

    const camera = this.systems?.get('camera') as { viewYaw?: number } | null | undefined;
    const yaw = camera?.viewYaw ?? 0;
    if (yaw === 0) return { x, y };
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    return { x: x * cos + y * sin, y: y * cos - x * sin };
  }

  /** Middle-drag accumulated since the last call, in canvas pixels. */
  consumeOrbitDrag(): { x: number; y: number } {
    const drag = { x: this.orbitDragX, y: this.orbitDragY };
    this.orbitDragX = 0;
    this.orbitDragY = 0;
    return drag;
  }

  /** True once after a middle click, meaning the camera should return to its default framing. */
  consumeOrbitReset(): boolean {
    const requested = this.orbitResetRequested;
    this.orbitResetRequested = false;
    return requested;
  }

  /**
   * True once per physical key press (ignores key-repeat). Call from gameplay that should start on tap
   * rather than requiring the key to stay held.
   */
  consumeKeyJustPressed(key: string): boolean {
    const k = key.toLowerCase();
    if (!this.keysJustPressed.has(k)) return false;
    this.keysJustPressed.delete(k);
    return true;
  }

  /** Use for Alt+key bindings; Ctrl+key is often captured by the browser before we see it. */
  isAltPressed(): boolean {
    return !!this.keys['alt'];
  }

  /** Clear all key and mouse state so menu open doesn't leave stale input (e.g. W still held). */
  clearAllKeys(): void {
    this.keys = {};
    this.keysJustPressed.clear();
    this.mouseDown = false;
    this.isCharging = false;
    this.rightMouseDown = false;
    this.middleMouseDown = false;
    this.orbitDragX = 0;
    this.orbitDragY = 0;
    this.middleDragDistance = 0;
    this.orbitResetRequested = false;
  }

  clearClick(): void {
    this.mouseClicked = false;
  }

  clearRightClick(): void {
    this.rightMouseClicked = false;
  }

  isRightMouseDown(): boolean {
    return this.rightMouseDown;
  }

  getWheelDelta(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  getChargeDuration(): number {
    if (this.isCharging) {
      return (performance.now() - this.chargeStartTime) / 1000;
    }
    return 0;
  }

  _emitLeftMouseUp(shiftKey: boolean): void {
    const chargeDuration = this.isCharging ? (performance.now() - this.chargeStartTime) / 1000 : 0;
    this.mouseDown = false;
    this.isCharging = false;
    this.systems!.eventBus.emit(EventTypes.INPUT_MOUSEUP, {
      x: this.mouseX,
      y: this.mouseY,
      chargeDuration,
      shiftKey,
    });
  }
}
