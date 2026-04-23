/**
 * zones.js — Goal-frame conversion heatmap.
 */

(function () {
    const loadBtn = document.getElementById('zones-load-btn');
    loadBtn.addEventListener('click', loadZones);

    // Pre-draw empty frame on init
    drawGoalFrame('zones-canvas');

    async function loadZones() {
        const data = await apiGet('/api/zones');
        if (!data.zones) return;

        const canvas = document.getElementById('zones-canvas');
        const ctx    = canvas.getContext('2d');
        const W      = canvas.width;
        const H      = canvas.height;

        const fx = GOAL_PAD_X;
        const fy = GOAL_PAD_TOP;
        const fw = W - GOAL_PAD_X * 2;
        const fh = H - GOAL_PAD_TOP - GOAL_PAD_BOT;

        // Re-draw the base goal frame first
        drawGoalFrame('zones-canvas');

        const zoneW = fw / 3;
        const zoneH = fh / 2;

        // Zone positions: [row, col] => top/bottom × left/center/right
        const positions = {
            'top_left':      [0, 0],
            'top_center':    [0, 1],
            'top_right':     [0, 2],
            'bottom_left':   [1, 0],
            'bottom_center': [1, 1],
            'bottom_right':  [1, 2],
        };

        Object.entries(positions).forEach(([key, [row, col]]) => {
            const zd   = data.zones[key] || { conversion: 0, total: 0, goals: 0 };
            const conv = zd.conversion;

            const zx = fx + col * zoneW;
            const zy = fy + row * zoneH;

            // Heat fill — green intensity by conversion rate
            const alpha = Math.min(conv / 45, 0.72);
            ctx.fillStyle = `rgba(15, 121, 72, ${alpha})`;
            ctx.fillRect(zx + 1, zy + 1, zoneW - 2, zoneH - 2);

            // Zone border
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth   = 1;
            ctx.strokeRect(zx, zy, zoneW, zoneH);

            // Conversion %
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';

            // Pick label color for contrast
            ctx.fillStyle = alpha > 0.4 ? '#ffffff' : '#1a202c';

            ctx.font = `700 ${Math.floor(zoneH * 0.28)}px Inter, sans-serif`;
            ctx.fillText(`${conv}%`, zx + zoneW / 2, zy + zoneH / 2 - 8);

            ctx.font = `400 ${Math.floor(zoneH * 0.17)}px Inter, sans-serif`;
            ctx.fillStyle = alpha > 0.4 ? 'rgba(255,255,255,0.8)' : '#6b7280';
            ctx.fillText(`${zd.goals}G / ${zd.total} shots`, zx + zoneW / 2, zy + zoneH / 2 + 14);
        });

        document.getElementById('zones-note').textContent =
            'Conversion rate = Goals ÷ Shots on Target. Darker = higher rate.';
    }
})();
