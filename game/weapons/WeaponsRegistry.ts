// Registry of player weapons (built from weaponConfigs). Dagger is shared with enemies.
import {
    SwordAndShieldWeapon,
    DaggerWeaponInstance,
    GreatswordWeaponInstance,
    CrossbowWeaponInstance,
    MaceWeaponInstance
} from './weaponConfigs.ts';

export const Weapons: Record<string, unknown> = {
    swordAndShield: SwordAndShieldWeapon,
    dagger: DaggerWeaponInstance,
    greatsword: GreatswordWeaponInstance,
    crossbow: CrossbowWeaponInstance,
    mace: MaceWeaponInstance
};
