// Shared weapon behavior: config parsing and attack/charge resolution. No base class; each weapon delegates here.
//
// WEAPON CONFIG OPTIONS (parseWeaponConfig):
//   Top-level:
//     name              - Weapon id (e.g. 'greatsword').
//     twoHanded         - true = two-handed (no block by convention).
//     baseRange         - Default reach in world units; stages can override with range or rangeMultiplier.
//     baseDamage        - Base damage; each stage uses baseDamage * damageMultiplier.
//     baseArcDegrees    - Default cone angle in degrees; stages can override with arcDegrees.
//     cooldown          - Seconds between attacks (base; cooldownMultiplier scales it).
//     cooldownMultiplier - Multiplier for cooldown (e.g. 0.5 = half cooldown).
//     attackSpeed       - Scale for swing duration: stage duration is duration/attackSpeed (< 1 = slower).
//     comboWindow       - Seconds after an attack to chain the next combo hit before reset.
//     maxComboStage     - Max combo step (e.g. 3 = slash1, slash2, chop); if null, uses stages.length.
//     rangeMultiplier   - Global multiplier applied to all stage ranges.
//     weaponLength      - Used for visuals/grip (e.g. sweep origin).
//     stages            - Array of combo/dash stage configs (see STAGE OPTIONS below).
//     dashAttack        - Optional special stage for dash (e.g. move+attack); same shape as a stage.
//     chargeAttack      - Optional { minChargeTime, maxChargeTime, damageMultiplier, rangeMultiplier,
//                          staminaCostMultiplier, chargedStageIndex [, chargedThrustDashSpeed, ...] }.
//     block             - Optional block config (see BLOCK OPTIONS); null = no block.
//     knockback         - Optional { force } fallback for stages without knockbackForce.
//     attackVisual      - Optional visual/effect key.
//
// STAGE OPTIONS (each entry in stages or dashAttack):
//     name, animationKey - Identifier and animation to play.
//     arcDegrees         - Hit cone angle (degrees). 360+ = full circle. Ignored for thrust.
//     arcOffsetDegrees   - Rotate cone center (e.g. for alternating slashes).
//     range              - Reach in world units (or use rangeMultiplier of baseRange).
//     rangeMultiplier    - Alternative: baseRange * rangeMultiplier.
//     duration           - Attack duration in ms (divided by weapon attackSpeed).
//     staminaCost        - Stamina consumed for this hit.
//     damageMultiplier   - damage = baseDamage * damageMultiplier.
//     stunBuildup        - Stun added per hit.
//     knockbackForce     - Push force (world units); optional.
//     reverseSweep       - true = sweep direction reversed for visuals.
//     thrust             - true = thin rectangle hitbox (forward) instead of arc.
//     thrustWidth        - Width of thrust rectangle (small = thin strip); used when thrust is true.
//     dashSpeed          - Optional: movement speed during attack (dash attacks).
//     dashDuration       - Optional: seconds the dash lasts (dash attacks).
//
// BLOCK OPTIONS (when block is set):
//     enabled, animationKey - Enable block and animation key.
//     arcDegrees         - Block cone (e.g. 180 = front half).
//     damageReduction    - 0–1; 1 = full block, 0.5 = 50% damage through.
//     staminaCost        - Stamina per successful block.
//     shieldBash         - Optional { knockback, dashSpeed, dashDuration, staminaCost, range, arcDegrees }.
//
(function () {
    const CHARGE_TIME_TOLERANCE = 0.05;

    function degToRad(deg) {
        return typeof Utils !== 'undefined' ? Utils.degToRad(deg) : (deg * Math.PI / 180);
    }

    function buildBlockFromConfig(blockConfig) {
        if (blockConfig == null || blockConfig.enabled === false) return null;
        const arcDegrees = blockConfig.arcDegrees ?? 180;
        const block = {
            enabled: blockConfig.enabled !== false,
            arcRad: degToRad(arcDegrees),
            damageReduction: blockConfig.damageReduction ?? 1.0,
            staminaCost: blockConfig.staminaCost ?? 5,
            animationKey: blockConfig.animationKey ?? 'block'
        };
        if (blockConfig.shieldBash) {
            const sb = blockConfig.shieldBash;
            block.shieldBash = {
                knockback: sb.knockback ?? 500,
                dashSpeed: sb.dashSpeed ?? 380,
                dashDuration: sb.dashDuration ?? 0.22,
                staminaCost: sb.staminaCost ?? 14,
                range: sb.range ?? 100,
                arcRad: degToRad(sb.arcDegrees ?? 120)
            };
        }
        return block;
    }

    function buildStageProps(stageConfig, weapon, stageIndex) {
        if (!stageConfig || !weapon) return null;
        const arcDegrees = stageConfig.arcDegrees != null
            ? stageConfig.arcDegrees
            : (stageConfig.arc != null ? stageConfig.arc * 180 / Math.PI : weapon.baseArcDegrees);
        const arcRad = stageConfig.arcDegrees != null
            ? degToRad(stageConfig.arcDegrees)
            : (stageConfig.arc != null ? stageConfig.arc : degToRad(weapon.baseArcDegrees));
        const isCircular = arcDegrees >= 360;
        const knockbackForce = stageConfig.knockbackForce ?? stageConfig.knockback?.force ?? weapon.knockback?.force ?? null;
        const stunBuildup = stageConfig.stunBuildup != null ? stageConfig.stunBuildup : 25;
        const arcOffset = stageConfig.arcOffsetDegrees != null ? degToRad(stageConfig.arcOffsetDegrees) : 0;
        const baseStageRange = stageConfig.range != null
            ? stageConfig.range
            : weapon.baseRange * (stageConfig.rangeMultiplier || 1.0);
        const isThrust = stageConfig.thrust === true;
        const thrustWidth = stageConfig.thrustWidth != null ? stageConfig.thrustWidth : 40;
        const reverseSweep = stageConfig.reverseSweep === true;
        const attackSpeed = weapon.attackSpeed ?? 1;
        const rawDuration = stageConfig.duration || 100;
        const duration = Math.round(rawDuration / attackSpeed);
        return {
            range: baseStageRange * (weapon.rangeMultiplier ?? 1),
            damage: weapon.baseDamage * (stageConfig.damageMultiplier || 1.0),
            arc: arcRad,
            arcOffset,
            reverseSweep,
            duration,
            staminaCost: stageConfig.staminaCost || 10,
            dashSpeed: stageConfig.dashSpeed || null,
            dashDuration: stageConfig.dashDuration || 0,
            stageName: stageConfig.name || (typeof stageIndex === 'string' ? stageIndex : `stage${stageIndex}`),
            animationKey: stageConfig.animationKey || 'melee',
            isCircular,
            isThrust,
            thrustWidth,
            knockbackForce,
            stunBuildup
        };
    }

    function getThrustStageIndex(comboConfig) {
        if (!comboConfig) return null;
        for (let i = 0; i < comboConfig.length; i++) {
            if (comboConfig[i].thrust === true) return i + 1;
        }
        return null;
    }

    function getChargeState(chargeDuration, chargeAttackConfig) {
        if (!chargeAttackConfig || !chargeAttackConfig.minChargeTime) {
            return { isCharged: false, chargeMultiplier: 0 };
        }
        const effectiveMin = chargeAttackConfig.minChargeTime - CHARGE_TIME_TOLERANCE;
        const isCharged = chargeDuration >= effectiveMin;
        const span = (chargeAttackConfig.maxChargeTime - chargeAttackConfig.minChargeTime) || 1;
        const chargeMultiplier = !isCharged ? 0 : Math.max(0, Math.min(1, (chargeDuration - chargeAttackConfig.minChargeTime) / span));
        return { isCharged, chargeMultiplier };
    }

    function resolveAttack(weapon, chargeDuration, comboStage, options) {
        const useDashAttack = options.useDashAttack && weapon.dashAttack;
        if (useDashAttack) {
            const stageProps = weapon.getDashAttackProperties();
            if (!stageProps) return null;
            return {
                stageProps,
                finalDamage: stageProps.damage,
                finalRange: stageProps.range,
                finalStaminaCost: stageProps.staminaCost,
                dashSpeed: stageProps.dashSpeed,
                dashDuration: stageProps.dashDuration,
                nextComboStage: 1,
                isCharged: false,
                chargeMultiplier: 0
            };
        }
        const chargeState = getChargeState(chargeDuration, weapon.chargeAttack);
        const maxStage = (weapon.maxComboStage != null && weapon.maxComboStage > 0) ? weapon.maxComboStage : (weapon.comboConfig && weapon.comboConfig.length) || 1;
        const nextComboStage = chargeState.isCharged ? 0 : (comboStage < maxStage ? comboStage + 1 : 1);
        const useChargedThrust = chargeState.isCharged && weapon.chargeAttack && weapon.chargeAttack.chargedThrustDashSpeed != null;
        const thrustStageIndex = getThrustStageIndex(weapon.comboConfig);
        const c = weapon.chargeAttack;
        const chargedStageIndex = (c && c.chargedStageIndex != null) ? c.chargedStageIndex : null;
        const stageForLookup = chargeState.isCharged
            ? (chargedStageIndex != null ? chargedStageIndex : (thrustStageIndex != null ? thrustStageIndex : 1))
            : nextComboStage;
        let stageProps = weapon.getComboStageProperties(stageForLookup);
        if (!stageProps) return null;
        if (useChargedThrust && thrustStageIndex != null) {
            const thrustProps = weapon.getComboStageProperties(thrustStageIndex);
            if (thrustProps) stageProps = thrustProps;
        }
        let finalDamage = stageProps.damage;
        let finalRange = stageProps.range;
        let finalStaminaCost = stageProps.staminaCost;
        if (chargeState.isCharged && c && chargeState.chargeMultiplier > 0) {
            const dm = 1 + (c.damageMultiplier - 1) * chargeState.chargeMultiplier;
            const rm = 1 + (c.rangeMultiplier - 1) * chargeState.chargeMultiplier;
            const sm = 1 + (c.staminaCostMultiplier - 1) * chargeState.chargeMultiplier;
            finalDamage = stageProps.damage * dm;
            finalRange = stageProps.range * rm;
            finalStaminaCost = stageProps.staminaCost * sm;
        }
        let dashSpeed = stageProps.dashSpeed;
        let dashDuration = stageProps.dashDuration;
        if (useChargedThrust && c) {
            const minD = c.chargedThrustDashDistanceMin ?? 25;
            const maxD = c.chargedThrustDashDistanceMax ?? 140;
            const dashDistance = minD + (maxD - minD) * chargeState.chargeMultiplier;
            dashSpeed = c.chargedThrustDashSpeed;
            dashDuration = dashDistance / dashSpeed;
        }
        return {
            stageProps,
            finalDamage,
            finalRange,
            finalStaminaCost,
            dashSpeed,
            dashDuration,
            nextComboStage,
            isCharged: chargeState.isCharged,
            chargeMultiplier: chargeState.chargeMultiplier
        };
    }

    /** Returns parsed config object for weapon constructors (name, baseRange, comboConfig, block, etc.).
     * Balancing: attackSpeed < 1 = slower swing (longer duration), cooldown = seconds between attacks,
     * cooldownMultiplier scales cooldown (e.g. 1.2 = 20% longer wait between attacks). */
    function parseWeaponConfig(config) {
        const stages = config.stages || [];
        const block = buildBlockFromConfig(config.block);
        const attackSpeed = config.attackSpeed ?? 1;
        const baseCooldown = config.cooldown ?? 0.3;
        const cooldownMultiplier = config.cooldownMultiplier ?? 1;
        return {
            name: config.name || 'weapon',
            baseRange: config.baseRange ?? 100,
            baseDamage: config.baseDamage ?? 15,
            baseArcDegrees: config.baseArcDegrees ?? 60,
            attackSpeed,
            cooldown: baseCooldown * cooldownMultiplier,
            comboConfig: stages,
            maxComboStage: config.maxComboStage != null ? config.maxComboStage : null,
            comboWindow: config.comboWindow ?? 1.5,
            knockback: config.knockback ?? null,
            block,
            twoHanded: config.twoHanded === true,
            dashAttack: config.dashAttack ?? config.specialAttack ?? null,
            rangeMultiplier: config.rangeMultiplier != null ? config.rangeMultiplier : 1,
            weaponLength: config.weaponLength != null ? config.weaponLength : null,
            chargeAttack: config.chargeAttack ?? null,
            attackVisual: config.attackVisual ?? null
        };
    }

    window.WeaponBehavior = {
        buildBlockFromConfig,
        buildStageProps,
        getThrustStageIndex,
        getChargeState,
        resolveAttack,
        parseWeaponConfig
    };
})();
