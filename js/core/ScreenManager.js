// Screen Manager - handles game state and screen rendering
class ScreenManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.currentScreen = 'title'; // 'title', 'hub', 'playing', 'death', 'pause'
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

    renderTitleScreen() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 52px Cinzel, Georgia, serif';
        this.ctx.fillText('Dungeon Crawler', width / 2, height / 2 - 130);

        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '500 14px Cinzel, Georgia, serif';
        this.ctx.fillText('Select level', width / 2, height / 2 - 78);

        const b = this.getLevelSelectBounds();
        for (const row of b.rows) {
            const isSelected = this.selectedStartLevel === row.level;
            this.ctx.fillStyle = isSelected ? 'rgba(201, 162, 39, 0.25)' : 'rgba(20, 16, 8, 0.6)';
            this.ctx.fillRect(b.cx - b.rowW / 2, row.y - b.rowH / 2, b.rowW, b.rowH);
            this.ctx.strokeStyle = isSelected ? '#c9a227' : '#4a3020';
            this.ctx.lineWidth = isSelected ? 2 : 1;
            this.ctx.strokeRect(b.cx - b.rowW / 2, row.y - b.rowH / 2, b.rowW, b.rowH);
            this.ctx.fillStyle = isSelected ? '#e8dcc8' : '#a08060';
            this.ctx.font = isSelected ? '600 14px Cinzel, Georgia, serif' : '500 13px Cinzel, Georgia, serif';
            this.ctx.fillText(`${row.level}. ${row.name}`, b.cx, row.y);
        }

        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '500 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Press SPACE or click Enter to begin', width / 2, height / 2 + 52);

        const buttonX = width / 2;
        const buttonY = height / 2 + 88;
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

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 38px Cinzel, Georgia, serif';
        this.ctx.fillText('Paused', width / 2, height / 2 - 70);

        const buttonWidth = 200;
        const buttonHeight = 44;
        const cx = width / 2;
        const resumeY = height / 2 - 10;
        const quitY = height / 2 + 48;

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, resumeY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, resumeY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText('Resume', cx, resumeY);

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
        this.ctx.fillText('Press ESC to resume', width / 2, height / 2 + 100);
    }

    getPauseButtonAt(x, y) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buttonWidth = 200;
        const buttonHeight = 44;
        const cx = width / 2;
        const resumeY = height / 2 - 10;
        const quitY = height / 2 + 48;
        const left = cx - buttonWidth / 2;
        const right = cx + buttonWidth / 2;
        if (x >= left && x <= right && y >= resumeY - buttonHeight / 2 && y <= resumeY + buttonHeight / 2) return 'resume';
        if (x >= left && x <= right && y >= quitY - buttonHeight / 2 && y <= quitY + buttonHeight / 2) return 'quit';
        return null;
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
        this.ctx.fillText('Press SPACE or click to try again', width / 2, height / 2 - 18);

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
        this.ctx.fillText('Try again', buttonX, buttonY);
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
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 28px Cinzel, Georgia, serif';
        this.ctx.fillText('Select level', width / 2, height / 2 - 100);

        const b = this.getLevelSelectBounds();
        const rowH = 32;
        const rowW = 280;
        const startY = height / 2 - 48;
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

        const cx = width / 2;
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

    render() {
        if (this.currentScreen === 'title') {
            this.renderTitleScreen();
        } else if (this.currentScreen === 'death') {
            this.renderDeathScreen();
        } else if (this.currentScreen === 'pause') {
            this.renderPauseScreen();
        }
        // 'hub' and 'playing' screens are handled by the normal game rendering
    }
}

