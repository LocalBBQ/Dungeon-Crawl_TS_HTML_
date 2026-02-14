// Gatherable Manager - handles herbs, ore, chests, shrine blessings placed from scene tiles.
// Player sees interact symbol when in range; click or E starts a 3s progress ring.
// Click again when the bar reaches the highlight to complete the gather early.
class GatherableManager {
    static GATHER_DURATION = 3;
    /** Half-width of quick-time window around sweet spot (0..1); zone = [sweetSpot - this, sweetSpot + this]. Small = hardest. */
    static QUICK_TIME_HALF_WIDTH = 0.03;
    /** Sweet spot is random in [MIN, MAX] (fraction of full circle, 0 = top) */
    static SWEET_SPOT_MIN = 0.25;
    static SWEET_SPOT_MAX = 0.85;
    /** Extra distance (world units) around each gatherable for interaction; player can interact from this range. */
    static INTERACT_RANGE = 30;

    constructor(gameRef) {
        this.items = [];
        this.useCooldown = 0;
        this.gameRef = gameRef || null;
        /** @type {{ item: object } | null} when non-null, player is gathering this item */
        this.gathering = null;
        /** 0..1 progress of current gather */
        this.gatherProgress = 0;
        /** Set each frame: true if player overlaps any gatherable (so attack can be suppressed on click) */
        this.playerInGatherableRange = false;
        /** Set each frame: true if player is in range of any gatherable (for showing E prompt only; interaction requires pressing E) */
        this.playerNearGatherable = false;
    }

    /**
     * Add a gatherable at world position (called by ObstacleManager when placing scene tiles).
     * @param {number} x - World X (center or left, depending on usage)
     * @param {number} y - World Y
     * @param {number} width - Hit area width
     * @param {number} height - Hit area height
     * @param {string} type - 'herb' | 'ore' | 'chest' | 'shrineBlessing'
     */
    add(x, y, width, height, type) {
        this.items.push({
            id: `gath_${this.items.length}_${Date.now()}`,
            x,
            y,
            width: width || 32,
            height: height || 32,
            type: type || 'herb',
            collected: false,
            pulsePhase: Math.random() * Math.PI * 2
        });
    }

    clear() {
        this.items = [];
        this.useCooldown = 0;
        this.gathering = null;
        this.gatherProgress = 0;
        this.playerInGatherableRange = false;
        this.playerNearGatherable = false;
    }

    /**
     * Apply reward for a gatherable type. Uses player components and optional game.gold.
     */
    applyReward(type, player, systems) {
        const game = this.gameRef;
        const health = player.getComponent(Health);
        const playerHealing = player.getComponent(PlayerHealing);

        switch (type) {
            case 'herb':
                if (playerHealing) {
                    playerHealing.charges = Math.min(playerHealing.maxCharges, playerHealing.charges + 1);
                }
                break;
            case 'ore':
                if (game && typeof game.gold === 'number') game.gold += 5;
                break;
            case 'chest':
                if (playerHealing) {
                    playerHealing.charges = Math.min(playerHealing.maxCharges, playerHealing.charges + 2);
                }
                if (game && typeof game.gold === 'number') game.gold += 15;
                break;
            case 'shrineBlessing':
                if (health) {
                    const healAmount = Math.floor(health.maxHealth * 0.5);
                    health.heal(healAmount);
                }
                if (playerHealing) {
                    playerHealing.charges = Math.min(playerHealing.maxCharges, playerHealing.charges + 1);
                }
                break;
            default:
                if (playerHealing) {
                    playerHealing.charges = Math.min(playerHealing.maxCharges, playerHealing.charges + 1);
                }
        }
    }

    update(deltaTime, systems) {
        if (this.useCooldown > 0) this.useCooldown -= deltaTime;

        const entityManager = systems && systems.get ? systems.get('entities') : null;
        const player = entityManager ? entityManager.get('player') : null;
        const inputSystem = systems && systems.get ? systems.get('input') : null;

        this.playerInGatherableRange = false;
        this.playerNearGatherable = false;

        if (!player || !inputSystem) return;

        const transform = player.getComponent(Transform);
        if (!transform) return;

        const playerLeft = transform.left;
        const playerTop = transform.top;
        const playerWidth = transform.width;
        const playerHeight = transform.height;

        const clicked = inputSystem.mouseClicked === true;
        const ePressed = inputSystem.isKeyPressed('e');

        /** Player can interact when within INTERACT_RANGE of the item's bounds (expanded rect check). */
        const canInteractWith = (item) => {
            const R = GatherableManager.INTERACT_RANGE;
            const ix = item.x - R;
            const iy = item.y - R;
            const iw = item.width + 2 * R;
            const ih = item.height + 2 * R;
            return Utils.rectCollision(playerLeft, playerTop, playerWidth, playerHeight, ix, iy, iw, ih);
        };

        // If currently gathering: advance progress, allow quick-time click, or cancel
        if (this.gathering) {
            const item = this.gathering.item;
            const stillOverlapping = canInteractWith(item);
            if (!stillOverlapping) {
                this.gathering = null;
                this.gatherProgress = 0;
            } else {
                const sweetSpot = this.gathering.sweetSpot;
                const hw = GatherableManager.QUICK_TIME_HALF_WIDTH;
                const zoneMin = Math.max(0, sweetSpot - hw);
                const zoneMax = Math.min(1, sweetSpot + hw);
                const inQuickTimeZone = this.gatherProgress >= zoneMin && this.gatherProgress <= zoneMax;
                if ((clicked || ePressed) && inQuickTimeZone) {
                    item.collected = true;
                    this.useCooldown = 0.4;
                    this.applyReward(item.type, player, systems);
                    this.gathering = null;
                    this.gatherProgress = 0;
                    if (clicked && inputSystem.clearClick) inputSystem.clearClick();
                } else {
                    this.gatherProgress += deltaTime / GatherableManager.GATHER_DURATION;
                    if (this.gatherProgress >= 1) {
                        item.collected = true;
                        this.useCooldown = 0.4;
                        this.applyReward(item.type, player, systems);
                        this.gathering = null;
                        this.gatherProgress = 0;
                    }
                }
                if (clicked && inputSystem.clearClick) inputSystem.clearClick();
            }
        } else {
            for (const item of this.items) {
                if (item.collected) continue;

                item.pulsePhase += deltaTime * 2;

                const overlapping = canInteractWith(item);
                if (overlapping) this.playerNearGatherable = true;
                if (!overlapping) continue;

                if (this.useCooldown > 0) continue;
                if (this.gathering) continue;
                if (!ePressed) continue;

                const sweetSpot = GatherableManager.SWEET_SPOT_MIN + Math.random() * (GatherableManager.SWEET_SPOT_MAX - GatherableManager.SWEET_SPOT_MIN);
                this.gathering = { item, sweetSpot };
                this.gatherProgress = 0;
                break;
            }
        }

        if (this.gathering) {
            this.playerInGatherableRange = true;
        } else {
            for (const item of this.items) {
                if (item.collected) continue;
                if (canInteractWith(item)) {
                    this.playerNearGatherable = true;
                    break;
                }
            }
        }

        this.items = this.items.filter(i => !i.collected);

        if (this.gameRef) this.gameRef.playerInGatherableRange = this.playerInGatherableRange;
    }

    /**
     * Draw the gather progress ring next to the player (above/right so it doesn't cover the character).
     */
    renderGatherRing(ctx, camera, player) {
        if (!this.gathering || !player) return;

        const transform = player.getComponent(Transform);
        if (!transform) return;

        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        const screenX = camera.toScreenX(centerX) + 22;
        const screenY = camera.toScreenY(centerY) - 28;

        const radius = 14;
        const lineWidth = 5;
        const progress = Math.min(1, this.gatherProgress);
        const sweetSpot = this.gathering.sweetSpot;
        const highlightRadius = Math.min(3.5, lineWidth * 0.65);

        ctx.save();

        // Background ring (dark)
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(40, 35, 30, 0.75)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Progress arc (clockwise from top). End angle = -Math.PI/2 + 2*PI*progress
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * progress;
        if (progress > 0.001) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, startAngle, endAngle);
            ctx.strokeStyle = 'rgba(120, 200, 120, 0.95)';
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Highlight at this gather's random sweet spot (click when bar reaches here to finish early); kept inside the ring
        const highlightAngle = -Math.PI / 2 + Math.PI * 2 * sweetSpot;
        const hx = screenX + Math.cos(highlightAngle) * radius;
        const hy = screenY + Math.sin(highlightAngle) * radius;
        ctx.beginPath();
        ctx.arc(hx, hy, highlightRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 180, 0.98)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draw interact symbol (E) above the player when in range of a gatherable and not gathering.
     */
    renderInteractPrompt(ctx, camera, player) {
        if (this.gathering || !this.playerNearGatherable || !player) return;

        const transform = player.getComponent(Transform);
        if (!transform) return;

        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        const screenX = camera.toScreenX(centerX);
        const screenY = camera.toScreenY(centerY) - 48;

        ctx.save();
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText('E', screenX, screenY);
        ctx.fillText('E', screenX, screenY);
        ctx.restore();
    }

    render(ctx, camera) {
        for (const item of this.items) {
            const screenX = camera.toScreenX(item.x + item.width / 2);
            const screenY = camera.toScreenY(item.y + item.height / 2);
            if (screenX < -60 || screenX > ctx.canvas.width + 60 ||
                screenY < -60 || screenY > ctx.canvas.height + 60) continue;

            const pulse = 1 + Math.sin(item.pulsePhase) * 0.12;
            const sizeScale = 0.5;
            const w = ((item.width * camera.zoom * pulse) / 2) * sizeScale;
            const h = ((item.height * camera.zoom * pulse) / 2) * sizeScale;

            const colors = {
                herb: { fill: '#4a7c4a', glow: 'rgba(100, 180, 100, 0.5)' },
                ore: { fill: '#6b5b4f', glow: 'rgba(180, 140, 90, 0.45)' },
                chest: { fill: '#8b6914', glow: 'rgba(220, 180, 80, 0.5)' },
                shrineBlessing: { fill: '#7b9ed4', glow: 'rgba(150, 180, 255, 0.5)' }
            };
            const style = colors[item.type] || colors.herb;

            ctx.save();
            ctx.beginPath();
            const grd = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, Math.max(w, h) * 2);
            grd.addColorStop(0, style.glow);
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.ellipse(screenX, screenY, Math.max(w, h) * 2, Math.max(w, h) * 2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = style.fill;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    }
}
