/**
 * Scene tile registry for chunk-based level assembly.
 * Biomes live in js/config/sceneTiles/*.js and attach to window (e.g. SceneTilesForest, SceneTilesCursedWilds).
 * This file composes them and exposes getTile(tileId). Tile ids are theme.tileName (e.g. forest.clearing, cursedWilds.graveyard).
 * Bare ids (e.g. clearing) resolve against forest for backward compatibility.
 * Used by ObstacleManager when config.useSceneTiles is true.
 */
(function () {
    var defaultTileSize = 800;

    var forest = (typeof window.SceneTilesForest !== 'undefined') ? window.SceneTilesForest : {};
    var cursedWilds = (typeof window.SceneTilesCursedWilds !== 'undefined') ? window.SceneTilesCursedWilds : {};
    var demonApproach = (typeof window.SceneTilesDemonApproach !== 'undefined') ? window.SceneTilesDemonApproach : {};

    window.SceneTiles = {
        defaultTileSize: defaultTileSize,
        forest: forest,
        cursedWilds: cursedWilds,
        demonApproach: demonApproach,

        /**
         * Get tile definition by id. Supports namespaced ids (theme.tileName) or bare id (resolves against forest).
         * @param {string} tileId - e.g. 'forest.lumberMill', 'cursedWilds.graveyard', 'clearing'
         * @returns {{ width: number, height: number, obstacles: Array }|null}
         */
        getTile: function (tileId) {
            if (!tileId) return null;
            if (tileId.indexOf('.') !== -1) {
                var parts = tileId.split('.');
                var theme = parts[0];
                var id = parts[1];
                var themeTiles = this[theme];
                return themeTiles && themeTiles[id] ? themeTiles[id] : null;
            }
            return forest && forest[tileId] ? forest[tileId] : null;
        }
    };
})();
