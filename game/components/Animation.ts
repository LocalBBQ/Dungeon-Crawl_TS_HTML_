// Animation component - handles sprite animation
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';
import { Movement } from './Movement.ts';
import { Combat } from './Combat.ts';
import { Health } from './Health.ts';

export interface AnimationDef {
  frames?: number[];
  frameDuration?: number;
  loop?: boolean;
  row?: number;
  spriteSheetKey?: string;
}

export interface AnimationConfig {
  spriteSheetKey?: string;
  defaultSpriteSheetKey?: string;
  animations?: Record<string, AnimationDef>;
  defaultAnimation?: string | null;
}

export class Animation implements Component {
  defaultSpriteSheetKey: string;
  animations: Record<string, AnimationDef>;
  currentAnimation: string | null;
  currentFrame: number;
  elapsedTime: number;
  isPlaying: boolean;
  loop: boolean;
  entity: { getComponent<T>(c: new (...args: unknown[]) => T): T | null } | null;

  constructor(config: AnimationConfig) {
    this.defaultSpriteSheetKey = config.spriteSheetKey ?? config.defaultSpriteSheetKey ?? '';
    this.animations = config.animations ?? {};
    this.currentAnimation = config.defaultAnimation ?? null;
    this.currentFrame = 0;
    this.elapsedTime = 0;
    this.isPlaying = true;
    this.loop = true;
    this.entity = null;
  }

  getCurrentSpriteSheetKey(): string {
    if (!this.currentAnimation) return this.defaultSpriteSheetKey;
    const anim = this.animations[this.currentAnimation];
    if (anim?.spriteSheetKey) return anim.spriteSheetKey;
    return this.defaultSpriteSheetKey;
  }

  setAnimation(name: string, loop = true): void {
    if (this.animations[name]) {
      if (this.currentAnimation !== name) {
        this.currentAnimation = name;
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isPlaying = true;
      }
      const anim = this.animations[name];
      this.loop = anim.loop !== undefined ? anim.loop : loop;
    }
  }

  update(deltaTime: number, systems?: SystemsMap): void {
    if (!this.entity) return;
    this.updateAnimationState(systems);

    if (!this.isPlaying || !this.currentAnimation) return;
    const anim = this.animations[this.currentAnimation];
    if (!anim) return;

    const frameDuration = anim.frameDuration ?? 0.15;
    this.elapsedTime += deltaTime;

    if (this.elapsedTime >= frameDuration) {
      this.elapsedTime = 0;
      this.currentFrame++;
      if (this.currentFrame >= (anim.frames?.length ?? 0)) {
        const shouldLoop = anim.loop !== undefined ? anim.loop : this.loop;
        if (shouldLoop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = Math.max(0, (anim.frames?.length ?? 1) - 1);
          this.isPlaying = false;
          if (this.animations.idle && this.currentAnimation !== 'idle') {
            setTimeout(() => {
              if (this.entity && this.animations.idle) this.setAnimation('idle', true);
            }, 100);
          }
        }
      }
    }
  }

  updateAnimationState(systems?: SystemsMap): void {
    const movement = this.entity!.getComponent(Movement);
    const combat = this.entity!.getComponent(Combat);
    const health = this.entity!.getComponent(Health);
    if (!movement) return;

    const combatEx = combat as (Combat & { isLunging?: boolean }) | null;
    if (combatEx?.isLunging && this.animations.lunge) {
      if (this.currentAnimation !== 'lunge') this.setAnimation('lunge', false);
      return;
    }
    if (combat?.isAttacking) {
      const animKey = (combat as Combat & { currentAttackAnimationKey?: string | null }).currentAttackAnimationKey ?? 'melee';
      if (this.animations[animKey]) {
        if (this.currentAnimation !== animKey) this.setAnimation(animKey, false);
      } else if (this.animations.melee) {
        if (this.currentAnimation !== 'melee') this.setAnimation('melee', false);
      }
      return;
    }
    if (combat?.isBlocking && this.animations.block) {
      if (this.currentAnimation !== 'block') this.setAnimation('block', true);
      return;
    }
    const movementEx = movement as Movement & { isDodging?: boolean };
    if (movementEx.isDodging && this.animations.roll) {
      if (this.currentAnimation !== 'roll') this.setAnimation('roll', false);
      return;
    }
    const healthEx = health as (Health & { wasJustHit?: boolean }) | null;
    if (healthEx?.wasJustHit && this.animations.takeDamage) {
      if (this.currentAnimation !== 'takeDamage') this.setAnimation('takeDamage', false);
      setTimeout(() => {
        if (healthEx) healthEx.wasJustHit = false;
      }, 200);
      return;
    }
    const isMoving = movement.velocityX !== 0 || movement.velocityY !== 0;
    const movementSprint = movement as Movement & { isSprinting?: boolean };
    if (isMoving) {
      if (movementSprint.isSprinting && this.animations.run) {
        if (this.currentAnimation !== 'run') this.setAnimation('run', true);
      } else if (this.animations.walk) {
        if (this.currentAnimation !== 'walk') this.setAnimation('walk', true);
      }
    } else {
      if (this.animations.idle && this.currentAnimation !== 'idle') {
        this.setAnimation('idle', true);
      }
    }
  }

  getCurrentFrameIndex(): number {
    if (!this.currentAnimation) return 0;
    const anim = this.animations[this.currentAnimation];
    if (!anim?.frames) return 0;
    return anim.frames[this.currentFrame] ?? 0;
  }

  getCurrentRow(): number {
    if (!this.currentAnimation) return 0;
    const anim = this.animations[this.currentAnimation];
    return anim?.row ?? 0;
  }

  getCurrentCol(): number {
    return this.getCurrentFrameIndex();
  }

  reset(): void {
    this.currentFrame = 0;
    this.elapsedTime = 0;
    this.isPlaying = true;
  }

  stop(): void {
    this.isPlaying = false;
  }

  play(): void {
    this.isPlaying = true;
  }
}
