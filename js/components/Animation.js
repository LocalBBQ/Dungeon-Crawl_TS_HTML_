// Animation component - handles sprite animation
class Animation {
    constructor(config) {
        this.defaultSpriteSheetKey = config.spriteSheetKey || config.defaultSpriteSheetKey; // Default/fallback sprite sheet
        this.animations = config.animations || {}; // Animation definitions
        this.currentAnimation = config.defaultAnimation || null;
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isPlaying = true;
        this.loop = true;
        this.entity = null;
    }
    
    // Get sprite sheet key for current animation
    getCurrentSpriteSheetKey() {
        if (!this.currentAnimation) return this.defaultSpriteSheetKey;
        const anim = this.animations[this.currentAnimation];
        if (anim && anim.spriteSheetKey) {
            return anim.spriteSheetKey;
        }
        return this.defaultSpriteSheetKey;
    }

    // Set the current animation
    setAnimation(name, loop = true) {
        if (this.animations[name]) {
            // Only change if it's a different animation
            if (this.currentAnimation !== name) {
                this.currentAnimation = name;
                this.currentFrame = 0;
                this.elapsedTime = 0;
                this.isPlaying = true;
            }
            // Update loop setting from animation config if available
            const anim = this.animations[name];
            this.loop = anim.loop !== undefined ? anim.loop : loop;
        }
    }

    // Update animation frame and state
    update(deltaTime, systems) {
        if (!this.entity) return;

        // Update animation state based on entity state
        this.updateAnimationState(systems);

        if (!this.isPlaying || !this.currentAnimation) return;

        const anim = this.animations[this.currentAnimation];
        if (!anim) return;

        const frameDuration = anim.frameDuration || 0.15; // Default 0.15 seconds per frame
        this.elapsedTime += deltaTime;

        if (this.elapsedTime >= frameDuration) {
            this.elapsedTime = 0;
            const oldFrame = this.currentFrame;
            this.currentFrame++;

            if (this.currentFrame >= anim.frames.length) {
                // Use loop setting from animation config if available, otherwise use component's loop setting
                const shouldLoop = anim.loop !== undefined ? anim.loop : this.loop;
                if (shouldLoop) {
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = anim.frames.length - 1;
                    this.isPlaying = false;
                    // For non-looping animations, return to idle after completion
                    if (this.animations.idle && this.currentAnimation !== 'idle') {
                        setTimeout(() => {
                            if (this.entity && this.animations.idle) {
                                this.setAnimation('idle', true);
                            }
                        }, 100);
                    }
                }
            }
        }
    }

    // Update animation state based on entity movement/combat state
    updateAnimationState(systems) {
        const movement = this.entity.getComponent(Movement);
        const combat = this.entity.getComponent(Combat);
        const health = this.entity.getComponent(Health);
        
        if (!movement) return;

        // Priority order: combat > special states > movement > idle
        
        // 1a. Check for lunge (goblin/lesser demon) – use lunge sprite when lunging
        if (combat && combat.isLunging && this.animations.lunge) {
            if (this.currentAnimation !== 'lunge') {
                this.setAnimation('lunge', false);
            }
            return;
        }
        
        // 1. Check for combat states (highest priority)
        if (combat && combat.isAttacking) {
            const animKey = combat.currentAttackAnimationKey || 'melee';
            if (this.animations[animKey]) {
                if (this.currentAnimation !== animKey) {
                    this.setAnimation(animKey, false);
                }
            } else if (this.animations.melee) {
                if (this.currentAnimation !== 'melee') {
                    this.setAnimation('melee', false);
                }
            }
            return; // Don't check other states while attacking
        }
        
        // 2. Check for blocking
        if (combat && combat.isBlocking && this.animations.block) {
            if (this.currentAnimation !== 'block') {
                this.setAnimation('block', true);
            }
            return;
        }
        
        // 3. Check for dodging/rolling
        if (movement.isDodging && this.animations.roll) {
            if (this.currentAnimation !== 'roll') {
                this.setAnimation('roll', false);
            }
            return;
        }
        
        // 4. Check for taking damage
        if (health && health.wasJustHit && this.animations.takeDamage) {
            if (this.currentAnimation !== 'takeDamage') {
                this.setAnimation('takeDamage', false);
            }
            // Reset the flag after a short delay
            setTimeout(() => {
                if (health) health.wasJustHit = false;
            }, 200);
            return;
        }
        
        // 5. Check for movement
        const isMoving = movement.velocityX !== 0 || movement.velocityY !== 0;
        if (isMoving) {
            // Check if sprinting (for player)
            if (movement.isSprinting && this.animations.run) {
                if (this.currentAnimation !== 'run') {
                    this.setAnimation('run', true);
                }
            } else if (this.animations.walk) {
                if (this.currentAnimation !== 'walk') {
                    this.setAnimation('walk', true);
                }
            }
        } else {
            // 6. Idle state
            if (this.animations.idle) {
                if (this.currentAnimation !== 'idle') {
                    this.setAnimation('idle', true);
                }
            }
        }
    }

    // Get current frame index from animation
    getCurrentFrameIndex() {
        if (!this.currentAnimation) {
            return 0;
        }
        const anim = this.animations[this.currentAnimation];
        if (!anim || !anim.frames) {
            return 0;
        }
        const frameIndex = anim.frames[this.currentFrame] || 0;
        return frameIndex;
    }

    // Get current animation row (for sprite sheets organized by row)
    getCurrentRow() {
        if (!this.currentAnimation) return 0;
        const anim = this.animations[this.currentAnimation];
        if (!anim) return 0;
        return anim.row !== undefined ? anim.row : 0;
    }

    // Get current frame column (for sprite sheets organized by row)
    getCurrentCol() {
        if (!this.currentAnimation) return 0;
        const anim = this.animations[this.currentAnimation];
        if (!anim || !anim.frames) return 0;
        return this.getCurrentFrameIndex();
    }

    // Reset animation
    reset() {
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isPlaying = true;
    }

    // Stop animation
    stop() {
        this.isPlaying = false;
    }

    // Play animation
    play() {
        this.isPlaying = true;
    }
}

