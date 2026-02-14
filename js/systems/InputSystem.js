// Input System
class InputSystem {
    constructor(canvas) {
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

    init(systems) {
        this.systems = systems;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            // Tab: open/close inventory; emit so Game can toggle, do not set keys
            if (e.key === 'Tab') {
                e.preventDefault();
                if (this.systems && this.systems.eventBus) {
                    this.systems.eventBus.emit(EventTypes.INPUT_KEYDOWN, 'tab');
                }
                return;
            }
            // Block Ctrl/Cmd + any key: no browser shortcuts, no focus change, no game input
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const isModifierKey = e.key === 'Control' || e.key === 'Meta';
            if (isCtrlOrCmd || isModifierKey) {
                e.preventDefault();
                return;
            }
            this.keys[e.key.toLowerCase()] = true;
            this.systems.eventBus.emit(EventTypes.INPUT_KEYDOWN, e.key.toLowerCase());
        }, { capture: true });

        window.addEventListener('keyup', (e) => {
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
            this.systems.eventBus.emit(EventTypes.INPUT_KEYUP, e.key.toLowerCase());
        }, { capture: true });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                // Left click - start charging
                this.mouseDown = true;
                this.mouseClicked = true;
                this.isCharging = true;
                this.chargeStartTime = performance.now();
                this.systems.eventBus.emit(EventTypes.INPUT_MOUSEDOWN, { 
                    x: this.mouseX, 
                    y: this.mouseY,
                    shiftKey: e.shiftKey
                });
            } else if (e.button === 2) {
                // Right click
                this.rightMouseDown = true;
                this.rightMouseClicked = true;
                this.systems.eventBus.emit(EventTypes.INPUT_RIGHTCLICK, { 
                    x: this.mouseX, 
                    y: this.mouseY 
                });
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                // Left mouse button - release charge
                this._emitLeftMouseUp(e.shiftKey);
            } else if (e.button === 2) {
                // Right mouse button
                this.rightMouseDown = false;
                this.systems.eventBus.emit(EventTypes.INPUT_RIGHTCLICK_UP, { 
                    x: this.mouseX, 
                    y: this.mouseY 
                });
            }
        });

        // Left-button release on window so charge attack still fires when release happens outside canvas (e.g. while moving with WASD)
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.isCharging) {
                this._emitLeftMouseUp(e.shiftKey);
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.wheelDelta = e.deltaY;
        });
    }

    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] || false;
    }

    clearClick() {
        this.mouseClicked = false;
    }

    clearRightClick() {
        this.rightMouseClicked = false;
    }

    isRightMouseDown() {
        return this.rightMouseDown;
    }

    getWheelDelta() {
        const delta = this.wheelDelta;
        this.wheelDelta = 0;
        return delta;
    }

    getChargeDuration() {
        if (this.isCharging) {
            return (performance.now() - this.chargeStartTime) / 1000;
        }
        return 0;
    }

    /** Emit left mouse up (release charge). Uses last known mouse position so charge attack still fires if released outside canvas. */
    _emitLeftMouseUp(shiftKey) {
        const chargeDuration = this.isCharging ? (performance.now() - this.chargeStartTime) / 1000 : 0;
        this.mouseDown = false;
        this.isCharging = false;
        this.systems.eventBus.emit(EventTypes.INPUT_MOUSEUP, {
            x: this.mouseX,
            y: this.mouseY,
            chargeDuration: chargeDuration,
            shiftKey: shiftKey
        });
    }
}

