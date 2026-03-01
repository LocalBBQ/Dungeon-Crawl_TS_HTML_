/**
 * Registry of menu screen renderers. ScreenManager delegates render and getButtonAt to the active screen's renderer.
 */
import type { ScreenName } from '../../core/ScreenManager.js';
import type { SettingsLike } from '../../core/ScreenManager.js';
import type { SaveSlotInfo } from '../../core/SaveManager.js';

export interface MenuRenderOptions {
    settings?: SettingsLike;
    listSaveSlots?: () => SaveSlotInfo[];
    currentScreen?: ScreenName;
    isButtonPressed?: (screen: ScreenName, button: string) => boolean;
    canvas?: HTMLCanvasElement;
    /** When on pause screen: 'playing' = in a level (show Recall), 'hub' = in hub. */
    screenBeforePause?: 'playing' | 'hub' | null;
}

export interface MenuScreenRenderer {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void;
    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null;
}

const registry = new Map<ScreenName, MenuScreenRenderer>();

export function registerMenuScreen(screen: ScreenName, renderer: MenuScreenRenderer): void {
    registry.set(screen, renderer);
}

export function getMenuRenderer(screen: ScreenName): MenuScreenRenderer | undefined {
    return registry.get(screen);
}

export function isMenuScreen(screen: ScreenName): boolean {
    return registry.has(screen);
}
