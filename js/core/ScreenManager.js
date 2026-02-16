// Screen Manager - handles game state and screen rendering
class ScreenManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        // 'title', 'hub', 'playing', 'death', 'pause', 'settings', 'settings-controls'
        this.currentScreen = 'title';
        this.selectedStartLevel = 1; // 1, 2, or 3 for level select
    }

    setScreen(screen) {
        this.currentScreen = screen;
    }

    isScreen(screen) {
        return this.currentScreen === screen;
    }

    getLevelSelectBounds() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const rowH = 32;
        const rowW = 280;
        const startY = height / 2 - 48;
        return {
            cx, rowW, rowH, startY,
            rows: [
                { level: 1, y: startY, name: 'Village Outskirts' },
                { level: 2, y: startY + rowH, name: 'Cursed Wilds' },
                { level: 3, y: startY + rowH * 2, name: 'Demon Approach' }
            ]
        };
    }

    getLevelSelectAt(x, y) {
        const b = this.getLevelSelectBounds();
        const left = b.cx - b.rowW / 2;
        const right = b.cx + b.rowW / 2;
        for (const row of b.rows) {
            const top = row.y - b.rowH / 2;
            const bottom = row.y + b.rowH / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) return row.level;
        }
        return null;
    }

    getWeaponSelectBounds() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const rowH = 28;
        const rowW = 260;
        const startY = height / 2 + 52;
        return {
            cx, rowW, rowH, startY,
            rows: [
                { key: 'swordAndShield', label: 'Sword & Shield', y: startY },
                { key: 'dagger', label: 'Dagger', y: startY + rowH },
                { key: 'greatsword', label: 'Greatsword', y: startY + rowH * 2 },
                { key: 'crossbow', label: 'Crossbow', y: startY + rowH * 3 },
                { key: 'mace', label: 'Mace', y: startY + rowH * 4 }
            ]
        };
    }

    getWeaponSelectAt(x, y) {
        const b = this.getWeaponSelectBounds();
        const left = b.cx - b.rowW / 2;
        const right = b.cx + b.rowW / 2;
        for (const row of b.rows) {
            const top = row.y - b.rowH / 2;
            const bottom = row.y + b.rowH / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) return row.key;
        }
        return null;
    }

    renderTitleScreen() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Game title
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 52px Cinzel, Georgia, serif';
        this.ctx.fillText('Dungeon Crawl', width / 2, height / 2 - 90);

        // Subtitle / hint
        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '500 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Press SPACE or click Enter to begin', width / 2, height / 2);

        // Single Enter button
        const buttonX = width / 2;
        const buttonY = height / 2 + 60;
        const buttonWidth = 160;
        const buttonHeight = 48;

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#c9a227';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(buttonX - buttonWidth / 2 + 2, buttonY - buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4);

        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Enter', buttonX, buttonY);
    }

    renderPauseScreen() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        // Dimmed background
        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Title
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 38px Cinzel, Georgia, serif';
        this.ctx.fillText('Paused', cx, height / 2 - 120);

        // Resume / Settings / Help / Quit buttons
        const buttonWidth = 200;
        const buttonHeight = 44;
        const resumeY = height / 2 - 95;
        const settingsY = height / 2 - 45;
        const helpY = height / 2 + 5;
        const quitY = height / 2 + 55;

        // Resume button
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, resumeY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, resumeY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Resume', cx, resumeY);

        // Settings button
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, settingsY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, settingsY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Settings', cx, settingsY);

        // Help button
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, helpY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, helpY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Help — Pack modifiers', cx, helpY);

        // Quit button
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, quitY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, quitY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '600 14px Cinzel, Georgia, serif';
        this.ctx.fillText('Quit to main menu', cx, quitY);

        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '500 13px Cinzel, Georgia, serif';
        this.ctx.fillText('Press ESC to resume', cx, height / 2 + 200);
    }

    getPauseButtonAt(x, y) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buttonWidth = 200;
        const buttonHeight = 44;
        const cx = width / 2;
        const resumeY = height / 2 - 95;
        const settingsY = height / 2 - 45;
        const helpY = height / 2 + 5;
        const quitY = height / 2 + 55;
        const left = cx - buttonWidth / 2;
        const right = cx + buttonWidth / 2;
        if (x >= left && x <= right && y >= resumeY - buttonHeight / 2 && y <= resumeY + buttonHeight / 2) return 'resume';
        if (x >= left && x <= right && y >= settingsY - buttonHeight / 2 && y <= settingsY + buttonHeight / 2) return 'settings';
        if (x >= left && x <= right && y >= helpY - buttonHeight / 2 && y <= helpY + buttonHeight / 2) return 'help';
        if (x >= left && x <= right && y >= quitY - buttonHeight / 2 && y <= quitY + buttonHeight / 2) return 'quit';
        return null;
    }

    /** Build a short description line for a pack modifier from its config. */
    getPackModifierDescription(name, def) {
        if (!def) return '';
        const parts = [];
        if (def.speedMultiplier != null && def.speedMultiplier !== 1) {
            const pct = Math.round((def.speedMultiplier - 1) * 100);
            parts.push(pct > 0 ? `+${pct}% speed` : `${pct}% speed`);
        }
        if (def.damageMultiplier != null && def.damageMultiplier !== 1) {
            const pct = Math.round((def.damageMultiplier - 1) * 100);
            parts.push(pct > 0 ? `+${pct}% damage` : `${pct}% damage`);
        }
        if (def.knockbackResist != null && def.knockbackResist > 0) {
            parts.push(`+${Math.round(def.knockbackResist * 100)}% knockback resist`);
        }
        if (def.attackCooldownMultiplier != null && def.attackCooldownMultiplier !== 1) {
            const pct = Math.round((1 - def.attackCooldownMultiplier) * 100);
            parts.push(`${pct}% faster attacks`);
        }
        if (def.stunBuildupPerHitMultiplier != null && def.stunBuildupPerHitMultiplier !== 1) {
            const pct = Math.round((def.stunBuildupPerHitMultiplier - 1) * 100);
            parts.push(`+${pct}% stun buildup`);
        }
        if (def.detectionRangeMultiplier != null && def.detectionRangeMultiplier !== 1) {
            const pct = Math.round((def.detectionRangeMultiplier - 1) * 100);
            parts.push(`+${pct}% detection range`);
        }
        if (def.healthMultiplier != null && def.healthMultiplier !== 1) {
            const pct = Math.round((def.healthMultiplier - 1) * 100);
            parts.push(pct > 0 ? `+${pct}% health` : `${pct}% health`);
        }
        return parts.length ? parts.join(', ') : '—';
    }

    /** Draw a small info tile at top center when hovering an enemy: name, health bar, modifier (only if present), short description. */
    renderEnemyTooltip(displayName, modifierName, modifierDescription, healthPercent) {
        const width = this.canvas.width;
        const padding = 16;
        const lineHeight = 20;
        const maxTextWidth = 280;
        const barHeight = 6;
        const barGap = 8;
        const modifierTopGap = 6;

        const hasModifier = modifierName && typeof modifierName === 'string' && modifierName.trim().length > 0;
        const modifierLabel = hasModifier ? (modifierName.charAt(0).toUpperCase() + modifierName.slice(1)) : '';
        const lines = [displayName];
        if (modifierLabel) lines.push(modifierLabel);
        if (hasModifier && modifierDescription) lines.push(modifierDescription);

        this.ctx.font = '500 14px Cinzel, Georgia, serif';
        const measure = (t) => this.ctx.measureText(t).width;
        const tileWidth = Math.min(maxTextWidth, Math.max(...lines.map((t) => measure(t))) + padding * 2);
        const hasBar = typeof healthPercent === 'number' && healthPercent >= 0;
        const barArea = hasBar ? barHeight + barGap : 0;
        const modifierGapArea = (hasModifier && (modifierLabel || modifierDescription)) ? modifierTopGap : 0;
        const tileHeight = padding * 2 + lines.length * lineHeight + barArea + modifierGapArea;

        const cx = width / 2;
        const top = 12;
        const left = cx - tileWidth / 2;
        const topPad = 10;

        this.ctx.fillStyle = 'rgba(26, 16, 8, 0.92)';
        this.ctx.fillRect(left, top, tileWidth, tileHeight + topPad);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(left, top, tileWidth, tileHeight + topPad);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const packModifiers = (typeof GameConfig !== 'undefined' && GameConfig.packModifiers) ? GameConfig.packModifiers : {};
        const modDef = modifierName ? packModifiers[modifierName] : null;
        const modifierColor = (modDef && modDef.color) ? modDef.color : '#e8dcc8';

        let y = top + topPad / 2 + lineHeight / 2;
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText(lines[0], cx, y);
        y += lineHeight;

        if (hasBar) {
            const barWidth = tileWidth - padding * 2;
            const barX = left + padding;
            const barY = y + barGap / 2;
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            const pct = Math.max(0, Math.min(1, healthPercent));
            this.ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffff44' : '#ff4444';
            this.ctx.fillRect(barX, barY, barWidth * pct, barHeight);
            this.ctx.strokeStyle = '#222';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
            y += barHeight + barGap;
        }
        if (modifierGapArea > 0) y += modifierTopGap;

        if (lines.length > 1) {
            this.ctx.fillStyle = modifierColor;
            this.ctx.font = '500 13px Cinzel, Georgia, serif';
            this.ctx.fillText(lines[1], cx, y);
            y += lineHeight;
        }
        if (lines.length > 2) {
            this.ctx.fillStyle = '#a08060';
            this.ctx.font = '500 12px Cinzel, Georgia, serif';
            this.ctx.fillText(lines[2], cx, y);
        }
    }

    renderHelpScreen() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        // Dim overlay but leave bottom cutout so health/stamina orbs stay visible
        const bottomCutoutH = 200;
        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        this.ctx.fillRect(0, 0, width, height - bottomCutoutH);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 36px Cinzel, Georgia, serif';
        this.ctx.fillText('Pack modifiers', cx, 72);

        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '500 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Enemies in a pack (same type, nearby) get one random modifier. Tag appears above them when buff is active.', cx, 112);

        const packModifiers = GameConfig.packModifiers || {};
        const names = Object.keys(packModifiers);
        const lineHeight = 28;
        const startY = 142;

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const def = packModifiers[name];
            const capName = name.charAt(0).toUpperCase() + name.slice(1);
            const desc = this.getPackModifierDescription(name, def);
            const line = desc ? `${capName} — ${desc}` : capName;
            const y = startY + i * lineHeight;

            this.ctx.fillStyle = def && def.color ? def.color : '#e8dcc8';
            this.ctx.font = '600 16px Cinzel, Georgia, serif';
            this.ctx.fillText(line, cx, y);
        }

        const backY = height - 56;
        const buttonWidth = 120;
        const buttonHeight = 40;
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 16px Cinzel, Georgia, serif';
        this.ctx.fillText('Back', cx, backY);
    }

    getHelpBackButtonAt(x, y) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const backY = height - 56;
        const buttonWidth = 120;
        const buttonHeight = 40;
        const left = cx - buttonWidth / 2;
        const right = cx + buttonWidth / 2;
        if (x >= left && x <= right && y >= backY - buttonHeight / 2 && y <= backY + buttonHeight / 2) return true;
        return false;
    }

    renderDeathScreen() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 38px Cinzel, Georgia, serif';
        this.ctx.fillText('Thou art fallen', width / 2, height / 2 - 70);

        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '500 14px Cinzel, Georgia, serif';
        this.ctx.fillText('Press SPACE or click to return to Sanctuary', width / 2, height / 2 - 18);

        const buttonX = width / 2;
        const buttonY = height / 2 + 48;
        const buttonWidth = 160;
        const buttonHeight = 48;

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#c9a227';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(buttonX - buttonWidth / 2 + 2, buttonY - buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4);

        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Return to Sanctuary', buttonX, buttonY);
    }

    checkButtonClick(x, y, screen) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buttonX = width / 2;
        const buttonY = screen === 'title' ? height / 2 + 88 : height / 2 + 48;
        const buttonWidth = 160;
        const buttonHeight = 48;

        const buttonLeft = buttonX - buttonWidth / 2;
        const buttonRight = buttonX + buttonWidth / 2;
        const buttonTop = buttonY - buttonHeight / 2;
        const buttonBottom = buttonY + buttonHeight / 2;

        return x >= buttonLeft && x <= buttonRight && y >= buttonTop && y <= buttonBottom;
    }

    // Hub board overlay: level select + Start / Back (canvas coords)
    getHubBoardButtonAt(x, y) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const buttonWidth = 120;
        const buttonHeight = 40;
        const startY = height / 2 + 52;
        const backY = height / 2 + 100;
        const left = cx - buttonWidth / 2;
        const right = cx + buttonWidth / 2;
        if (x >= left && x <= right && y >= startY - buttonHeight / 2 && y <= startY + buttonHeight / 2) return 'start';
        if (x >= left && x <= right && y >= backY - buttonHeight / 2 && y <= backY + buttonHeight / 2) return 'back';
        return null;
    }

    renderHubBoardOverlay(selectedLevel) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 28px Cinzel, Georgia, serif';
        this.ctx.fillText('Select level', cx, height / 2 - 100);

        const b = this.getLevelSelectBounds();
        const rowH = 32;
        const rowW = 280;
        for (let i = 0; i < b.rows.length; i++) {
            const row = b.rows[i];
            const isSelected = selectedLevel === row.level;
            this.ctx.fillStyle = isSelected ? 'rgba(201, 162, 39, 0.25)' : 'rgba(20, 16, 8, 0.6)';
            this.ctx.fillRect(b.cx - rowW / 2, row.y - rowH / 2, rowW, rowH);
            this.ctx.strokeStyle = isSelected ? '#c9a227' : '#4a3020';
            this.ctx.lineWidth = isSelected ? 2 : 1;
            this.ctx.strokeRect(b.cx - rowW / 2, row.y - rowH / 2, rowW, rowH);
            this.ctx.fillStyle = isSelected ? '#e8dcc8' : '#a08060';
            this.ctx.font = isSelected ? '600 14px Cinzel, Georgia, serif' : '500 13px Cinzel, Georgia, serif';
            this.ctx.fillText(`${row.level}. ${row.name}`, b.cx, row.y);
        }

        const buttonWidth = 120;
        const buttonHeight = 40;
        const startY_btn = height / 2 + 52;
        const backY = height / 2 + 100;

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, startY_btn - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#c9a227';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, startY_btn - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 14px Cinzel, Georgia, serif';
        this.ctx.fillText('Start', cx, startY_btn);

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '600 13px Cinzel, Georgia, serif';
        this.ctx.fillText('Back', cx, backY);
    }

    getWeaponChestOverlayBounds() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const rowH = 28;
        const rowW = 260;
        const startY = height / 2 - 30;
        return {
            cx, rowW, rowH, startY,
            backY: height / 2 + 120,
            rows: [
                { key: 'swordAndShield', label: 'Sword & Shield', y: startY },
                { key: 'dagger', label: 'Dagger', y: startY + rowH },
                { key: 'greatsword', label: 'Greatsword', y: startY + rowH * 2 },
                { key: 'crossbow', label: 'Crossbow', y: startY + rowH * 3 },
                { key: 'mace', label: 'Mace', y: startY + rowH * 4 }
            ]
        };
    }

    getWeaponChestWeaponAt(x, y) {
        const b = this.getWeaponChestOverlayBounds();
        const left = b.cx - b.rowW / 2;
        const right = b.cx + b.rowW / 2;
        for (const row of b.rows) {
            const top = row.y - b.rowH / 2;
            const bottom = row.y + b.rowH / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) return row.key;
        }
        return null;
    }

    getWeaponChestBackAt(x, y) {
        const b = this.getWeaponChestOverlayBounds();
        const buttonWidth = 120;
        const buttonHeight = 40;
        const left = b.cx - buttonWidth / 2;
        const right = b.cx + buttonWidth / 2;
        const top = b.backY - buttonHeight / 2;
        const bottom = b.backY + buttonHeight / 2;
        return x >= left && x <= right && y >= top && y <= bottom;
    }

    renderWeaponChestOverlay(equippedWeaponKey) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 26px Cinzel, Georgia, serif';
        this.ctx.fillText('Choose weapon', cx, height / 2 - 90);

        const b = this.getWeaponChestOverlayBounds();
        for (const row of b.rows) {
            const isEquipped = equippedWeaponKey === row.key;
            this.ctx.fillStyle = isEquipped ? 'rgba(201, 162, 39, 0.25)' : 'rgba(20, 16, 8, 0.6)';
            this.ctx.fillRect(b.cx - b.rowW / 2, row.y - b.rowH / 2, b.rowW, b.rowH);
            this.ctx.strokeStyle = isEquipped ? '#c9a227' : '#4a3020';
            this.ctx.lineWidth = isEquipped ? 2 : 1;
            this.ctx.strokeRect(b.cx - b.rowW / 2, row.y - b.rowH / 2, b.rowW, b.rowH);
            this.ctx.fillStyle = isEquipped ? '#e8dcc8' : '#a08060';
            this.ctx.font = isEquipped ? '600 13px Cinzel, Georgia, serif' : '500 12px Cinzel, Georgia, serif';
            this.ctx.fillText(row.label, b.cx, row.y);
        }

        const buttonWidth = 120;
        const buttonHeight = 40;
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, b.backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, b.backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '600 13px Cinzel, Georgia, serif';
        this.ctx.fillText('Back', cx, b.backY);
    }

    getSettingsLayout(settings) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        const rowHeight = 32;
        const rowWidth = 360;
        const startY = height / 2 - 60;

        const rows = [
            {
                key: 'music',
                label: 'Music',
                value: settings.musicEnabled,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 0 * 40
            },
            {
                key: 'sfx',
                label: 'Sound Effects',
                value: settings.sfxEnabled,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 1 * 40
            },
            {
                key: 'minimap',
                label: 'Minimap',
                value: settings.showMinimap,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 2 * 40
            },
            {
                key: 'characterSprites',
                label: 'Character Sprites',
                value: settings.useCharacterSprites,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 3 * 40
            },
            {
                key: 'environmentSprites',
                label: 'Environment Sprites',
                value: settings.useEnvironmentSprites,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 4 * 40
            },
            {
                key: 'playerHitboxIndicators',
                label: 'Player Hitbox Indicators',
                value: settings.showPlayerHitboxIndicators,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 5 * 40
            },
            {
                key: 'enemyHitboxIndicators',
                label: 'Enemy Hitbox Indicators',
                value: settings.showEnemyHitboxIndicators,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 6 * 40
            },
            {
                key: 'enemyStaminaBars',
                label: 'Enemy Stamina Bars',
                value: settings.showEnemyStaminaBars,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 7 * 40
            },
            {
                key: 'playerHealthBarAlways',
                label: 'Player Health Bar Always',
                value: settings.showPlayerHealthBarAlways,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 8 * 40
            },
            {
                key: 'enemyHealthBars',
                label: 'Enemy Health Bars',
                value: settings.showEnemyHealthBars,
                type: 'toggle',
                x: cx - rowWidth / 2,
                y: startY + 9 * 40
            },
            {
                key: 'controls',
                label: 'Controls',
                type: 'link',
                x: cx - rowWidth / 2,
                y: startY + 10 * 40
            }
        ];

        // Place the back button below the last settings row
        const lastRow = rows[rows.length - 1];
        const backY = lastRow.y + 60;

        const backButton = {
            key: 'back',
            label: 'Back',
            x: cx - 80,
            y: backY,
            width: 160,
            height: 40
        };

        return { rows, backButton, rowWidth, rowHeight };
    }

    renderSettingsScreen(settings) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        // Dim background
        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.80)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Title
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 34px Cinzel, Georgia, serif';
        this.ctx.fillText('Settings', cx, height / 2 - 140);

        const layout = this.getSettingsLayout(settings);

        // Setting rows as buttons
        layout.rows.forEach((row) => {
            // Button rect
            this.ctx.fillStyle = 'rgba(20, 16, 8, 0.8)';
            this.ctx.fillRect(row.x, row.y - layout.rowHeight / 2, layout.rowWidth, layout.rowHeight);

            this.ctx.strokeStyle = '#4a3020';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(row.x, row.y - layout.rowHeight / 2, layout.rowWidth, layout.rowHeight);

            // Text (toggle: "Label: On/Off", link: "Label")
            this.ctx.fillStyle = '#e8dcc8';
            this.ctx.font = '500 15px Cinzel, Georgia, serif';
            const text = row.type === 'link' ? row.label : `${row.label}: ${row.value ? 'On' : 'Off'}`;
            this.ctx.fillText(text, cx, row.y);
        });

        // Back button
        const back = layout.backButton;
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(back.x, back.y - back.height / 2, back.width, back.height);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(back.x, back.y - back.height / 2, back.width, back.height);

        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Back', cx, back.y);
    }

    getSettingsItemAt(x, y, settings) {
        const layout = this.getSettingsLayout(settings);

        // Check setting rows
        for (const row of layout.rows) {
            const left = row.x;
            const right = row.x + layout.rowWidth;
            const top = row.y - layout.rowHeight / 2;
            const bottom = row.y + layout.rowHeight / 2;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                return row.key; // 'music', 'sfx', or 'minimap'
            }
        }

        // Check Back button
        const back = layout.backButton;
        const left = back.x;
        const right = back.x + back.width;
        const top = back.y - back.height / 2;
        const bottom = back.y + back.height / 2;

        if (x >= left && x <= right && y >= top && y <= bottom) {
            return back.key; // 'back'
        }

        return null;
    }

    getControlsBackButton() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        return {
            x: cx - 80,
            y: height / 2 + 180,
            width: 160,
            height: 40
        };
    }

    getControlsItemAt(x, y) {
        const back = this.getControlsBackButton();
        if (x >= back.x && x <= back.x + back.width &&
            y >= back.y - back.height / 2 && y <= back.y + back.height / 2) {
            return 'back';
        }
        return null;
    }

    renderControlsScreen() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.90)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Title
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 34px Cinzel, Georgia, serif';
        this.ctx.fillText('Controls', cx, height / 2 - 200);

        // Control text (moved from in-game overlay)
        const lines = [
            'WASD — Move',
            'Shift — Sprint',
            'Space — Dodge',
            'Left click — Attack',
            'Right click — Block',
            'Q — Heal (tap to drink, then regen)',
            'Shift + Left click — Dash attack',
            'E — Portal to next area',
            'B — Return to Sanctuary',
            'In Sanctuary: E at board — Level select · E at chest — Change weapon'
        ];
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '500 15px Cinzel, Georgia, serif';
        this.ctx.textAlign = 'center';
        const lineHeight = 24;
        const startY = height / 2 - 140;
        lines.forEach((line, i) => {
            this.ctx.fillText(line, cx, startY + i * lineHeight);
        });

        // Back button
        const back = this.getControlsBackButton();
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(back.x, back.y - back.height / 2, back.width, back.height);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(back.x, back.y - back.height / 2, back.width, back.height);
        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Back', cx, back.y);
    }

    render(settings) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (this.currentScreen === 'title') {
            this.renderTitleScreen();
        } else if (this.currentScreen === 'death') {
            this.renderDeathScreen();
        } else if (this.currentScreen === 'pause') {
            this.renderPauseScreen();
        } else if (this.currentScreen === 'settings') {
            this.renderSettingsScreen(settings);
        } else if (this.currentScreen === 'settings-controls') {
            this.renderControlsScreen();
        } else if (this.currentScreen === 'help') {
            this.renderHelpScreen();
        }
        // 'hub' and 'playing' screens are handled by the normal game rendering
    }
}

