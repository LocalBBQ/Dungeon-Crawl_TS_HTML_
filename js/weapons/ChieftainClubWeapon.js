// Chieftain club: enemy-only weapon. Overhead slam in front of the chieftain, small circular AOE.
// Broken out like other weapons (config + interface); used by goblin chieftain via EnemyAttackHandler.
(function () {
    const config = {
        id: 'chieftainClub',
        name: 'Chieftain Club',
        visual: 'maceClub',
        heavySmash: {
            chargeTime: 1.15,
            releaseDuration: 0.22,
            damage: 16,
            knockbackForce: 280,
            // Slam in front: AOE circle placed ahead of the chieftain (not centered on him)
            aoeInFront: true,
            aoeOffset: 55,   // distance from entity center to slam circle center (in front)
            aoeRadius: 42   // radius of the slam impact circle
        }
    };

    const ChieftainClub = {
        id: config.id,
        name: config.name,
        visual: config.visual,
        heavySmash: config.heavySmash,

        getHeavySmashProperties() {
            const h = this.heavySmash;
            const arc = Math.PI * 2; // not used for hit when aoeInFront
            const range = h.aoeInFront
                ? (h.aoeOffset || 0) + (h.aoeRadius || 40)  // max distance for range checks
                : (h.range || 100);
            return {
                range,
                damage: h.damage,
                arc,
                isCircular: false,
                chargeTime: h.chargeTime,
                releaseDuration: h.releaseDuration,
                knockbackForce: h.knockbackForce,
                aoeInFront: !!(h.aoeInFront),
                aoeOffset: h.aoeOffset != null ? h.aoeOffset : 55,
                aoeRadius: h.aoeRadius != null ? h.aoeRadius : 42
            };
        }
    };

    window.ChieftainClubWeapon = ChieftainClub;
})();
