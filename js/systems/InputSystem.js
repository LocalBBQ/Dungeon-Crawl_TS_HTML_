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
    }

    init(systems) {
        this.systems = systems;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.systems.eventBus.emit('input:keydown', e.key.toLowerCase());
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.systems.eventBus.emit('input:keyup', e.key.toLowerCase());
        });

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
                // Left click
                this.mouseDown = true;
                this.mouseClicked = true;
                this.systems.eventBus.emit('input:click', { 
                    x: this.mouseX, 
                    y: this.mouseY 
                });
            } else if (e.button === 2) {
                // Right click
                this.rightMouseDown = true;
                this.rightMouseClicked = true;
                this.systems.eventBus.emit('input:rightclick', { 
                    x: this.mouseX, 
                    y: this.mouseY 
                });
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                // Left mouse button
                this.mouseDown = false;
            } else if (e.button === 2) {
                // Right mouse button
                this.rightMouseDown = false;
                this.systems.eventBus.emit('input:rightclickup', { 
                    x: this.mouseX, 
                    y: this.mouseY 
                });
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
}

