// Input manager for keyboard and mouse
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.mouseClicked = false;
        this.wheelDelta = 0;

        this.init();
    }

    init() {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.mouseDown = true;
            this.mouseClicked = true;
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.mouseDown = false;
        });

        // Mouse wheel event
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

    getWheelDelta() {
        const delta = this.wheelDelta;
        this.wheelDelta = 0; // Reset after reading
        return delta;
    }
}

