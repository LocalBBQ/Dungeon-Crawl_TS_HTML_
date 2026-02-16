// Phase 2: entry imports only Game; Game pulls in the rest via ESM
import { Game } from '../game/core/Game.js';

window.addEventListener('load', () => {
  const game = new Game();
  console.log('Dungeon Crawl initialized!');
});
