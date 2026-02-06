// Main game initialization and loop
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match screen
        this.resizeCanvas();

        // World size
        this.worldWidth = 2400;
        this.worldHeight = 1400;

        // Initialize game systems
        this.input = new InputManager(this.canvas);
        this.camera = new Camera(0, 0, this.worldWidth, this.worldHeight);
        this.player = new Player(this.worldWidth / 2, this.worldHeight / 2);
        this.renderer = new Renderer(this.canvas, this.ctx);
        
        // Initialize obstacle manager and generate environment
        this.obstacleManager = new ObstacleManager();
        this.obstacleManager.generateBorderTrees(this.worldWidth, this.worldHeight, 50);
        this.obstacleManager.generateForest(this.worldWidth, this.worldHeight, 0.03);
        this.obstacleManager.generateRocks(this.worldWidth, this.worldHeight, 0.015);

        // Initialize enemy manager and spawn initial enemies
        this.enemyManager = new EnemyManager();
        this.enemyManager.spawnEnemiesAroundPlayer(
            this.player, 
            5, // initial count
            200, 
            400, 
            this.worldWidth, 
            this.worldHeight, 
            this.obstacleManager
        );

        // Game state
        this.running = true;

        // Tick system - Fixed timestep for consistent gameplay
        this.TICK_RATE = 60; // 60 ticks per second
        this.TICK_DURATION = 1 / this.TICK_RATE; // 0.0167 seconds per tick
        this.accumulator = 0; // Accumulated time since last update
        this.maxFrameTime = 0.25; // Cap at 250ms to prevent spiral of death

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();
    }

    resizeCanvas() {
        // Set canvas size to match window dimensions
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    update(deltaTime) {
        // Handle camera zoom with mouse wheel
        const wheelDelta = this.input.getWheelDelta();
        if (wheelDelta !== 0) {
            const zoomSpeed = 0.05;
            const zoomChange = wheelDelta > 0 ? -zoomSpeed : zoomSpeed;
            const newZoom = this.camera.targetZoom + zoomChange;
            this.camera.setZoom(newZoom, this.input.mouseX, this.input.mouseY, this.canvas.width, this.canvas.height);
        }

        // Update zoom interpolation
        this.camera.updateZoom(this.canvas.width, this.canvas.height);

        // Update player
        this.player.update(this.input, this.camera, this.canvas, this.obstacleManager, deltaTime);
        
        // Update enemies
        this.enemyManager.update(this.player, this.obstacleManager, this.worldWidth, this.worldHeight, deltaTime);
        
        // Check player attacks against enemies
        this.enemyManager.checkPlayerAttack(this.player);
        
        // Update camera to follow player
        this.camera.follow(this.player, this.canvas.width, this.canvas.height);
        
        // Update UI
        this.player.updateUI();
    }

    render() {
        // Clear screen
        this.renderer.clear();
        
        // Draw world
        this.renderer.drawWorld(this.camera, this.obstacleManager);
        
        // Draw enemies
        this.renderer.drawEnemies(this.enemyManager.enemies, this.camera);
        
        // Draw player
        this.renderer.drawPlayer(this.player, this.camera);
        
        // Draw mini-map
        this.renderer.drawMinimap(this.camera, this.player, this.obstacleManager, this.enemyManager, this.worldWidth, this.worldHeight);
    }

    gameLoop() {
        if (!this.running) return;

        const currentTime = performance.now();
        let deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap deltaTime to prevent huge jumps (e.g., tab switching)
        if (deltaTime > this.maxFrameTime) {
            deltaTime = this.maxFrameTime;
        }

        // Accumulate time
        this.accumulator += deltaTime;

        // Run fixed timestep updates (catch up if behind)
        let ticksProcessed = 0;
        const maxTicksPerFrame = 5; // Prevent spiral of death
        
        while (this.accumulator >= this.TICK_DURATION && ticksProcessed < maxTicksPerFrame) {
            // Update game logic with fixed timestep
            this.update(this.TICK_DURATION);
            this.accumulator -= this.TICK_DURATION;
            ticksProcessed++;
        }

        // Render (can happen at variable rate)
        this.render();

        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    const game = new Game();
    console.log('Diablo-style ARPG initialized!');
});

