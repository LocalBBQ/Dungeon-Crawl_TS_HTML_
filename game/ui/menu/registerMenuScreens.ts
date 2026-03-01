/**
 * Registers all menu screen renderers with the registry. Import this once (e.g. from ScreenManager) so the registry is populated.
 */
import type { ScreenName } from '../../core/ScreenManager.js';
import { registerMenuScreen } from './MenuScreenRegistry.js';
import { titleScreenRenderer } from './TitleScreenRenderer.js';
import { classSelectScreenRenderer } from './ClassSelectScreenRenderer.js';
import { saveSelectScreenRenderer } from './SaveSelectScreenRenderer.js';
import { pauseScreenRenderer } from './PauseScreenRenderer.js';
import { deathScreenRenderer } from './DeathScreenRenderer.js';
import { settingsScreenRenderer } from './SettingsScreenRenderer.js';
import { controlsScreenRenderer } from './ControlsScreenRenderer.js';
import { helpScreenRenderer } from './HelpScreenRenderer.js';

const MENU_SCREENS: { screen: ScreenName; renderer: { render: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: unknown) => void; getButtonAt: (x: number, y: number, options?: unknown) => string | null } }[] = [
    { screen: 'title', renderer: titleScreenRenderer },
    { screen: 'classSelect', renderer: classSelectScreenRenderer },
    { screen: 'saveSelect', renderer: saveSelectScreenRenderer },
    { screen: 'pause', renderer: pauseScreenRenderer },
    { screen: 'death', renderer: deathScreenRenderer },
    { screen: 'settings', renderer: settingsScreenRenderer },
    { screen: 'settings-controls', renderer: controlsScreenRenderer },
    { screen: 'help', renderer: helpScreenRenderer }
];

export function registerAllMenuScreens(): void {
    for (const { screen, renderer } of MENU_SCREENS) {
        registerMenuScreen(screen, renderer);
    }
}
