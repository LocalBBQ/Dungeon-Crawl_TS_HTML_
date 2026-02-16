// Input System
import { EventTypes } from '../core/EventTypes.ts';
import type { SystemManager } from '../core/SystemManager.ts';

export class InputSystem {
  canvas: HTMLCanvasElement;
  keys: Record<string, boolean>;
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  mouseClicked: boolean;
  rightMouseDown: boolean;
  rightMouseClicked: boolean;
  wheelDelta: number;
  systems: SystemManager | null;
  chargeStartTime: number;
  isCharging: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.rightMouseDown = false;
    this.rightMouseClicked = false;
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
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (this.systems?.eventBus) {
          this.systems.eventBus.emit(EventTypes.INPUT_KEYDOWN, 'tab');
        }
        return;
      }
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isModifierKey = e.key === 'Control' || e.key === 'Meta';
      if (isCtrlOrCmd || isModifierKey) {
        e.preventDefault();
        return;
      }
      this.keys[e.key.toLowerCase()] = true;
      this.systems!.eventBus.emit(EventTypes.INPUT_KEYDOWN, e.key.toLowerCase());
    }, { capture: true });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd || e.key === 'Control' || e.key === 'Meta') {
        e.preventDefault();
        return;
      }
      this.keys[e.key.toLowerCase()] = false;
      this.systems!.eventBus.emit(EventTypes.INPUT_KEYUP, e.key.toLowerCase());
    }, { capture: true });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        this.isCharging = true;
        this.chargeStartTime = performance.now();
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
