/**
 * zones.js — Goal-frame conversion heatmap (standalone, no dependency on goal.js constants).
 */

(function () {
    const loadBtn = document.getElementById('zones-load-btn');
    const canvas  = document.getElementById('zones-canvas');
    const ctx     = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Local padding constants for the zones canvas
    const PAD_X   = 60;
    const PAD_TOP = 28;
    const PAD_BOT = 12;

    loadBtn.addEventListener('click', loadZones);

    // Draw initial empty goal frame
    drawFrame();

    function drawFrame() {
        ctx.clearRect(0, 0, W, H);

        const fx = PAD_X, fy = PAD_TOP;
        const fw = W - PAD_X * 2;
        const fh = H - PAD_TOP - PAD_BOT;

        // Background
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#e8f5e9');
        grad.addColorStop(1, '#c8e6c9');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Ground
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(0, H - PAD_BOT, W, PAD_BOT);
        ctx.fillStyle = '#6d9b3a';
        ctx.fillRect(0, H - PAD_BOT - 4, W, 4);

        // Net background
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(fx, fy, fw, fh);

        // Net grid
        ctx.strokeStyle = 'rgba(180,180,180,0.5)';
        ctx.lineWidth = 0.5;
        const cols = 18, rows = 10;
        for (let i = 1; i < cols; i++) {
            const nx = fx + (fw / cols) * i;
            ctx.beginPath(); ctx.moveTo(nx, fy); ctx.lineTo(nx, fy + fh); ctx.stroke();
        }
        for (let j = 1; j < rows; j++) {
            const ny = fy + (fh / rows) * j;
            ctx.beginPath(); ctx.moveTo(fx, ny); ctx.lineTo(fx + fw, ny); ctx.stroke();
        }

        // Posts & crossbar
        ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2;
        ctx.fillStyle = '#ffffff';
        const pw = 7;
        ctx.fillRect(fx - pw / 2, fy, pw, fh + PAD_BOT);
        ctx.fillRect(fx + fw - pw / 2, fy, pw, fh + PAD_BOT);
        ctx.fillRect(fx - pw / 2, fy - pw / 2, fw + pw, pw);
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;

        return { fx, fy, fw, fh };
    }

    async function loadZones() {
        const data = await apiGet('/api/zones');
        if (!data.zones) return;

        const { fx, fy, fw, fh } = drawFrame();

        const zoneW = fw / 3;
        const zoneH = fh / 2;

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

            // Heat fill
            const alpha = Math.min(conv / 45, 0.75);
            ctx.fillStyle = `rgba(15, 121, 72, ${alpha})`;
            ctx.fillRect(zx + 1, zy + 1, zoneW - 2, zoneH - 2);

            // Zone border
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            ctx.lineWidth   = 1;
            ctx.strokeRect(zx, zy, zoneW, zoneH);

            // Labels
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle    = alpha > 0.4 ? '#ffffff' : '#1a202c';
            ctx.font = `700 ${Math.floor(zoneH * 0.3)}px Inter, sans-serif`;
            ctx.fillText(`${conv}%`, zx + zoneW / 2, zy + zoneH / 2 - 10);

            ctx.font = `400 ${Math.floor(zoneH * 0.17)}px Inter, sans-serif`;
            ctx.fillStyle = alpha > 0.4 ? 'rgba(255,255,255,0.85)' : '#6b7280';
            ctx.fillText(`${zd.goals}G / ${zd.total} shots`, zx + zoneW / 2, zy + zoneH / 2 + 16);
        });

        document.getElementById('zones-note').textContent =
            'Conversion rate = Goals / Shots on Target. Darker zones = higher conversion.';
    }
})();
