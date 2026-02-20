// Player-specific movement component
import type { SystemsMap } from '../types/systems.js';
import { Movement } from './Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import { Transform } from './Transform.ts';
import { StatusEffects } from './StatusEffects.ts';
import { Combat } from './Combat.ts';
import { Health } from './Health.ts';
import { Combat } from './Combat.ts';
import { PlayerHealing } from './PlayerHealing.ts';
import { Stamina } from './Stamina.ts';

interface InputSystemLike {
  isKeyPressed(key: string): boolean;
  mouseX: number;
  mouseY: number;
}

interface CameraSystemLike {
  toWorldX(x: number): number;
  toWorldY(y: number): number;
}

export class PlayerMovement extends Movement {
  isSprinting: boolean;
  sprintMultiplier: number;
  sprintStaminaCost: number;
  isDodging: boolean;
  dodgeTimer: number;
  dodgeDuration: number;
  dodgeSpeed: number;
  dodgeDirectionX: number;
  dodgeDirectionY: number;
  dodgeCooldown: number;
  maxDodgeCooldown: number;
  isAttackDashing: boolean;
  attackDashTimer: number;
  attackDashDuration: number;
  attackDashSpeed: number;
  attackDashSpeedCurrent: number;
  attackDashDirectionX: number;
  attackDashDirectionY: number;

  constructor(speed: number) {
    super(speed);
    this.isSprinting = false;
    this.sprintMultiplier = GameConfig.player.sprint.multiplier;
    this.sprintStaminaCost = GameConfig.player.sprint.staminaCost;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeDuration = GameConfig.player.dodge.duration;
    this.dodgeSpeed = GameConfig.player.dodge.speed;
    this.dodgeDirectionX = 0;
    this.dodgeDirectionY = 0;
    this.dodgeCooldown = 0;
    this.maxDodgeCooldown = GameConfig.player.dodge.cooldown;
    this.isAttackDashing = false;
    this.attackDashTimer = 0;
    this.attackDashDuration = 0;
    this.attackDashSpeed = 450;
    this.attackDashSpeedCurrent = 450;
    this.attackDashDirectionX = 0;
    this.attackDashDirectionY = 0;
  }

  override update(deltaTime: number, systems?: SystemsMap): void {
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;

    const statusEffects = this.entity!.getComponent(StatusEffects);
    if (statusEffects?.isStunned) {
      this.velocityX = 0;
      this.velocityY = 0;
      return;
    }
    if (statusEffects?.isAirborne) {
      const air = statusEffects.getAirborneVelocity(transform.x, transform.y);
      this.velocityX = air.vx;
      this.velocityY = air.vy;
      this.applyMovement(deltaTime, systems);
      this.updateFacingAngle(deltaTime, systems);
      return;
    }

    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - deltaTime);
    }

    if (this.isAttackDashing) {
      this.attackDashTimer += deltaTime;
      const dashRampDuration = 0.08;
      const rampRaw = Math.min(1, this.attackDashTimer / dashRampDuration);
      const ramp = Utils.easeInQuad(rampRaw);
      const effectiveSpeed = this.attackDashSpeedCurrent * ramp;
      this.velocityX = this.attackDashDirectionX * effectiveSpeed;
      this.velocityY = this.attackDashDirectionY * effectiveSpeed;

      if (this.attackDashTimer >= this.attackDashDuration) {
        this.isAttackDashing = false;
        this.attackDashTimer = 0;
        this.attackDashSpeedCurrent = this.attackDashSpeed;
        const combat = this.entity!.getComponent(Combat);
        const isThrust = combat?.isPlayer && (combat as Combat & { currentAttackIsThrust?: boolean })
          .currentAttackIsThrust;
        if (isThrust && systems) {
          const inputSystem = systems.get?.('input') as InputSystemLike | undefined;
          if (inputSystem) {
            let moveX = 0, moveY = 0;
            if (inputSystem.isKeyPressed('w')) moveY -= 1;
            if (inputSystem.isKeyPressed('s')) moveY += 1;
            if (inputSystem.isKeyPressed('a')) moveX -= 1;
            if (inputSystem.isKeyPressed('d')) moveX += 1;
            if (moveX !== 0 || moveY !== 0) {
              const normalized = Utils.normalize(moveX, moveY);
              this.velocityX = normalized.x * this.speed;
              this.velocityY = normalized.y * this.speed;
            } else {
              this.velocityX = 0;
              this.velocityY = 0;
            }
          } else {
            this.velocityX = 0;
            this.velocityY = 0;
          }
        } else {
          this.velocityX = 0;
          this.velocityY = 0;
        }
      }
      this.applyMovement(deltaTime, systems);
      this.updateFacingAngle(deltaTime, systems);
    } else if (this.isDodging) {
      this.dodgeTimer += deltaTime;
      const health = this.entity!.getComponent(Health);
      if (health) health.isInvincible = true;
      this.velocityX = this.dodgeDirectionX * this.dodgeSpeed;
      this.velocityY = this.dodgeDirectionY * this.dodgeSpeed;

      if (this.dodgeTimer >= this.dodgeDuration) {
        this.isDodging = false;
        this.dodgeTimer = 0;
        if (health) health.isInvincible = false;
        const inputSystem = systems?.get?.('input') as InputSystemLike | undefined;
        if (inputSystem) {
          let moveX = 0, moveY = 0;
          if (inputSystem.isKeyPressed('w')) moveY -= 1;
          if (inputSystem.isKeyPressed('s')) moveY += 1;
          if (inputSystem.isKeyPressed('a')) moveX -= 1;
          if (inputSystem.isKeyPressed('d')) moveX += 1;
          if (moveX !== 0 || moveY !== 0) {
            const normalized = Utils.normalize(moveX, moveY);
            this.velocityX = normalized.x * this.speed;
            this.velocityY = normalized.y * this.speed;
          } else {
            this.velocityX = 0;
            this.velocityY = 0;
          }
        } else {
          this.velocityX = 0;
          this.velocityY = 0;
        }
      }
      this.applyMovement(deltaTime, systems);
      this.updateFacingAngle(deltaTime, systems);
    } else {
      if (this.isKnockedBack) {
        this.velocityX = this.knockbackVelocityX;
        this.velocityY = this.knockbackVelocityY;
        this.knockbackVelocityX *= Math.pow(this.knockbackDecay, deltaTime * 60);
        this.knockbackVelocityY *= Math.pow(this.knockbackDecay, deltaTime * 60);
        const minVelocity = 5;
        if (Math.abs(this.knockbackVelocityX) < minVelocity && Math.abs(this.knockbackVelocityY) < minVelocity) {
          this.isKnockedBack = false;
          this.knockbackVelocityX = 0;
          this.knockbackVelocityY = 0;
          const inputSystem = systems?.get?.('input') as InputSystemLike | undefined;
          if (inputSystem) {
            let moveX = 0, moveY = 0;
            if (inputSystem.isKeyPressed('w')) moveY -= 1;
            if (inputSystem.isKeyPressed('s')) moveY += 1;
            if (inputSystem.isKeyPressed('a')) moveX -= 1;
            if (inputSystem.isKeyPressed('d')) moveX += 1;
            if (moveX !== 0 || moveY !== 0) {
              const normalized = Utils.normalize(moveX, moveY);
              this.velocityX = normalized.x * this.speed;
              this.velocityY = normalized.y * this.speed;
            } else {
              this.velocityX = 0;
              this.velocityY = 0;
            }
          } else {
            this.velocityX = 0;
            this.velocityY = 0;
          }
        }
      } else {
        const healing = this.entity!.getComponent(PlayerHealing);
        if (healing?.isHealing) {
          this.speed = this.baseSpeed * 0.5;
          const mag = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
          if (mag > 0.01) {
            const scale = this.speed / mag;
            this.velocityX *= scale;
            this.velocityY *= scale;
          }
        } else {
          const combat = this.entity!.getComponent(Combat);
          if (combat?.isBlocking) {
            this.speed = this.baseSpeed * 0.5;
          } else {
            const stamina = this.entity!.getComponent(Stamina);
            if (this.isSprinting && stamina) {
              this.speed = this.baseSpeed * this.sprintMultiplier;
            } else if (!this.isSprinting) {
              this.speed = this.baseSpeed;
            }
          }
        }
      }
      this.updateMovement(deltaTime, systems);
      if (!this.isDodging && !this.isAttackDashing && !this.isKnockedBack) {
        const stamina = this.entity!.getComponent(Stamina);
        const combat = this.entity!.getComponent(Combat);
        const healing = this.entity!.getComponent(PlayerHealing);
        if (this.isSprinting && stamina && !combat?.isBlocking && !healing?.isHealing) {
          const isMoving = Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1;
          if (isMoving) {
            const staminaNeeded = this.sprintStaminaCost * deltaTime;
            if (stamina.currentStamina > staminaNeeded) {
              stamina.currentStamina -= staminaNeeded;
            } else {
              this.isSprinting = false;
              this.speed = this.baseSpeed;
            }
          }
        }
      }
      this.applyMovement(deltaTime, systems);
      this.updateFacingAngle(deltaTime, systems);
    }
  }

  override updateMovement(deltaTime: number, systems?: SystemsMap): void {
    if (this.isDodging || this.isAttackDashing || this.isKnockedBack) return;
    super.updateMovement(deltaTime, systems);
  }

  override updateFacingAngle(deltaTime: number, systems?: SystemsMap): void {
    const combat = this.entity!.getComponent(Combat);
    if (combat?.isAttacking) return;
    if (systems) {
      const inputSystem = systems.get?.('input') as InputSystemLike | undefined;
      const cameraSystem = systems.get?.('camera') as CameraSystemLike | undefined;
      const transform = this.entity!.getComponent(Transform);
      if (inputSystem && cameraSystem && transform) {
        const mouseWorldX = cameraSystem.toWorldX(inputSystem.mouseX);
        const mouseWorldY = cameraSystem.toWorldY(inputSystem.mouseY);
        this.facingAngle = Utils.angleTo(transform.x, transform.y, mouseWorldX, mouseWorldY);
      }
    }
  }

  setSprinting(isSprinting: boolean): void {
    this.isSprinting = isSprinting;
    if (isSprinting) this.speed = this.baseSpeed * this.sprintMultiplier;
    else this.speed = this.baseSpeed;
  }

  performDodge(directionX: number, directionY: number): boolean {
    if (this.isDodging || this.dodgeCooldown > 0) return false;
    const normalized = Utils.normalize(directionX, directionY);
    if (normalized.x === 0 && normalized.y === 0) {
      this.dodgeDirectionX = Math.cos(this.facingAngle);
      this.dodgeDirectionY = Math.sin(this.facingAngle);
    } else {
      this.dodgeDirectionX = normalized.x;
      this.dodgeDirectionY = normalized.y;
    }
    this.isDodging = true;
    this.dodgeTimer = 0;
    this.dodgeCooldown = this.maxDodgeCooldown;
    this.cancelPath();
    this.clearAttackTarget();
    return true;
  }

  startAttackDash(directionX: number, directionY: number, duration: number, speed?: number | null): boolean {
    this.attackDashDirectionX = directionX;
    this.attackDashDirectionY = directionY;
    this.attackDashDuration = duration;
    this.attackDashTimer = 0;
    this.attackDashSpeedCurrent = speed != null ? speed : this.attackDashSpeed;
    this.isAttackDashing = true;
    return true;
  }

  setAttackTarget(enemy: unknown): void {
    this.attackTarget = enemy;
  }

  clearAttackTarget(): void {
    this.attackTarget = null;
  }
}
