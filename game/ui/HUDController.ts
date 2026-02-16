/**
 * HUD and inventory panel updates: health/stamina orbs, inventory screen, player portrait.
 */
import type { Entity } from '../entities/Entity.js';
import type { PlayingStateShape } from '../state/PlayingState.js';
import { Health } from '../components/Health.js';
import { Stamina } from '../components/Stamina.js';
import { Combat } from '../components/Combat.js';
import { PlayerHealing } from '../components/PlayerHealing.js';
import { StatusEffects } from '../components/StatusEffects.js';
import { SpriteUtils } from '../utils/SpriteUtils.js';

export interface SystemsLike {
    get(name: string): unknown;
}

export interface EntitiesLike {
    get(id: string): Entity | undefined;
}

export interface HUDControllerContext {
    playingState: PlayingStateShape;
    systems: SystemsLike;
    entities: EntitiesLike;
}

const WEAPON_DISPLAY_NAMES: Record<string, string> = {
    swordAndShield: 'Sword & Shield',
    greatsword: 'Greatsword',
    mace: 'Mace',
    dagger: 'Dagger',
    crossbow: 'Crossbow'
};

function getWeaponDisplayName(key: string): string {
    if (!key) return '—';
    if (WEAPON_DISPLAY_NAMES[key]) return WEAPON_DISPLAY_NAMES[key];
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

export class HUDController {
    private ctx: HUDControllerContext;

    constructor(context: HUDControllerContext) {
        this.ctx = context;
    }

    update(player: Entity | undefined) {
        if (!player) return;
        if (this.ctx.playingState.inventoryOpen) this.refreshInventoryPanel();

        const health = player.getComponent(Health);
        const stamina = player.getComponent(Stamina);
        const combat = player.getComponent(Combat);

        if (health) {
            const healthPercent = health.percent * 100;
            const healthFillEl = document.getElementById('health-orb-fill');
            if (healthFillEl) healthFillEl.style.height = healthPercent + '%';
            const healthTextEl = document.getElementById('health-text');
            if (healthTextEl) healthTextEl.textContent =
                Math.floor(health.currentHealth) + '/' + health.maxHealth;
        }

        if (stamina) {
            const staminaPercent = stamina.percent * 100;
            const staminaFillEl = document.getElementById('stamina-orb-fill');
            if (staminaFillEl) staminaFillEl.style.height = staminaPercent + '%';
            const staminaTextEl = document.getElementById('stamina-text');
            if (staminaTextEl) staminaTextEl.textContent =
                Math.floor(stamina.currentStamina) + '/' + stamina.maxStamina;
            const staminaOrbEl = document.getElementById('stamina-orb');
            if (staminaOrbEl) {
                if (combat && combat.dashAttackFlashUntil > Date.now()) {
                    staminaOrbEl.classList.add('stamina-pulse');
                } else {
                    staminaOrbEl.classList.remove('stamina-pulse');
                }
            }
        }

        const healing = player.getComponent(PlayerHealing);
        const healChargesEl = document.getElementById('heal-charges');
        if (healing && healChargesEl) {
            healChargesEl.textContent = healing.charges + '/' + healing.maxCharges;
        }

        const statusEffects = player.getComponent(StatusEffects);
        const stunBarEl = document.getElementById('stun-bar');
        if (statusEffects && stunBarEl) {
            const pct = Math.min(100, statusEffects.stunMeterPercent * 100);
            stunBarEl.style.width = pct + '%';
        }

        const stunDurationRow = document.getElementById('stun-duration-row');
        const stunDurationBar = document.getElementById('stun-duration-bar');
        if (statusEffects && stunDurationRow && stunDurationBar) {
            if (statusEffects.isStunned) {
                stunDurationRow.style.display = '';
                const remain = statusEffects.stunDurationPercentRemaining * 100;
                stunDurationBar.style.width = remain + '%';
            } else {
                stunDurationRow.style.display = 'none';
            }
        }
    }

    setInventoryPanelVisible(visible: boolean) {
        const el = document.getElementById('inventory-screen');
        if (el) el.classList.toggle('hidden', !visible);
    }

    refreshInventoryPanel() {
        const player = this.ctx.entities.get('player');
        if (!player) return;
        const health = player.getComponent(Health);
        const stamina = player.getComponent(Stamina);
        const combat = player.getComponent(Combat);
        const healing = player.getComponent(PlayerHealing);

        const healthEl = document.getElementById('inventory-stat-health');
        const staminaEl = document.getElementById('inventory-stat-stamina');
        const healthBarEl = document.getElementById('inventory-bar-health');
        const staminaBarEl = document.getElementById('inventory-bar-stamina');
        const damageEl = document.getElementById('inventory-stat-damage');
        const weaponEl = document.getElementById('inventory-equip-weapon');
        const healChargesEl = document.getElementById('inventory-stat-heal');
        const killsEl = document.getElementById('inventory-stat-kills');
        if (healthEl && health) healthEl.textContent = Math.floor(health.currentHealth) + ' / ' + health.maxHealth;
        if (staminaEl && stamina) staminaEl.textContent = Math.floor(stamina.currentStamina) + ' / ' + stamina.maxStamina;
        if (healthBarEl && health) healthBarEl.style.width = (health.percent * 100) + '%';
        if (staminaBarEl && stamina) staminaBarEl.style.width = (stamina.percent * 100) + '%';
        if (healChargesEl && healing) healChargesEl.textContent = healing.charges + ' / ' + healing.maxCharges;
        if (damageEl && combat && combat.attackHandler) {
            const dmg = combat.attackHandler.attackDamage != null ? Math.floor(combat.attackHandler.attackDamage) : '—';
            damageEl.textContent = String(dmg);
        }
        if (weaponEl) weaponEl.textContent = getWeaponDisplayName(this.ctx.playingState.equippedWeaponKey);
        if (killsEl) killsEl.textContent = String(this.ctx.playingState.killsThisLife);

        this.drawInventoryPlayerPortrait();
    }

    drawInventoryPlayerPortrait() {
        const canvas = document.getElementById('inventory-player-portrait') as HTMLCanvasElement | null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const spriteManager = this.ctx.systems.get('sprites') as { knightSheets?: Record<string, string>; getSpriteSheet?(key: string): { rows: number; cols: number; image?: HTMLImageElement } | null } | undefined;
        if (!spriteManager) return;
        const knightSheets = spriteManager.knightSheets || {};
        const idleKey = knightSheets.idle || knightSheets.walk || null;
        if (!idleKey) return;
        const sheet = spriteManager.getSpriteSheet?.(idleKey);
        if (!sheet || !sheet.image) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const frontFrameCol = 0;
        const frontFrameRow = 0;
        const frameCoords = SpriteUtils.getFrameCoords(sheet, frontFrameRow, frontFrameCol);
        if (!frameCoords || frameCoords.sourceWidth <= 0 || frameCoords.sourceHeight <= 0) return;
        ctx.imageSmoothingEnabled = true;
        (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
        ctx.drawImage(
            sheet.image,
            frameCoords.sourceX, frameCoords.sourceY, frameCoords.sourceWidth, frameCoords.sourceHeight,
            0, 0, w, h
        );
    }

    getWeaponDisplayName(key: string): string {
        return getWeaponDisplayName(key);
    }
}
