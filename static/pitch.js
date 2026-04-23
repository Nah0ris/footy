/**
 * pitch.js — Renders the attacking-half pitch and handles xG click interaction.
 * StatsBomb coordinate system: 120 × 80. We display x: 55–120, y: 0–80.
 */

(function () {
    const canvas = document.getElementById('pitch-canvas');
    const ctx    = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // SB range we display
    const SB_X_MIN = 55, SB_X_MAX = 120;
    const SB_Y_MIN = 0,  SB_Y_MAX = 80;
    const GOAL_Y_MIN = 36, GOAL_Y_MAX = 44;

    let marker = null; // {cx, cy, sbX, sbY}

    // ── Coordinate helpers ──────────────────────────────────────────────────
    function toCanvas(sbX, sbY) {
        return {
            cx: mapRange(sbX, SB_X_MIN, SB_X_MAX, 0, W),
            cy: mapRange(sbY, SB_Y_MIN, SB_Y_MAX, 0, H),
        };
    }

    function toSB(cx, cy) {
        return {
            sbX: mapRange(cx, 0, W, SB_X_MIN, SB_X_MAX),
            sbY: mapRange(cy, 0, H, SB_Y_MIN, SB_Y_MAX),
        };
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function drawPitch() {
        ctx.clearRect(0, 0, W, H);

        // Grass — alternating light stripes
        const stripes = 8;
        const stripeW = W / stripes;
        for (let i = 0; i < stripes; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#3a8c3f' : '#379139';
            ctx.fillRect(i * stripeW, 0, stripeW, H);
        }

        // Lines
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth   = 1.5;

        // Boundaries
        line(0, 0, 0, H);              // half-line (left)
        line(0, 0, W, 0);              // top touchline
        line(0, H, W, H);              // bottom touchline
        line(W - 0.5, 0, W - 0.5, H); // goal line (right)

        // Penalty area: x=102–120, y=18–62
        const pa = { ...toCanvas(102, 18) };
        const pb = { ...toCanvas(120, 62) };
        ctx.strokeRect(pa.cx, pa.cy, pb.cx - pa.cx, pb.cy - pa.cy);

        // 6-yard box: x=114–120, y=30–50
        const sa = { ...toCanvas(114, 30) };
        const sb = { ...toCanvas(120, 50) };
        ctx.strokeRect(sa.cx, sa.cy, sb.cx - sa.cx, sb.cy - sa.cy);

        // Penalty spot
        const ps = toCanvas(108, 40);
        ctx.beginPath();
        ctx.arc(ps.cx, ps.cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();

        // Penalty arc (clip outside penalty box)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, pa.cx, H);
        ctx.clip();
        const penR_x = mapRange(10, 0, SB_X_MAX - SB_X_MIN, 0, W);
        const penR_y = mapRange(10, 0, SB_Y_MAX - SB_Y_MIN, 0, H);
        ctx.beginPath();
        ctx.ellipse(ps.cx, ps.cy, penR_x, penR_y, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Goal posts (thick white)
        const gTop = toCanvas(120, GOAL_Y_MIN);
        const gBot = toCanvas(120, GOAL_Y_MAX);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 4;
        ctx.beginPath();
        ctx.moveTo(gTop.cx, gTop.cy);
        ctx.lineTo(gBot.cx, gBot.cy);
        ctx.stroke();

        // Nets (dotted lines behind goal)
        ctx.setLineDash([3, 4]);
        ctx.lineWidth   = 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        for (let gy = GOAL_Y_MIN + 1; gy < GOAL_Y_MAX; gy += 1.33) {
            const gp = toCanvas(120, gy);
            ctx.beginPath();
            ctx.moveTo(gp.cx, gp.cy);
            ctx.lineTo(gp.cx + 12, gp.cy);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // ── Marker ──────────────────────────────────────────────────────────
        if (marker) {
            const gPostTop = toCanvas(120, GOAL_Y_MIN);
            const gPostBot = toCanvas(120, GOAL_Y_MAX);

            // Angle lines to posts
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth   = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(marker.cx, marker.cy); ctx.lineTo(gPostTop.cx, gPostTop.cy);
            ctx.moveTo(marker.cx, marker.cy); ctx.lineTo(gPostBot.cx, gPostBot.cy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Shadow
            ctx.beginPath();
            ctx.arc(marker.cx, marker.cy, 11, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fill();

            // Ball
            drawBall(ctx, marker.cx, marker.cy, 8);
        }
    }

    function drawBall(ctx, cx, cy, r) {
        // White circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Simple pentagon patch pattern
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
    }

    function line(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // ── Interaction ─────────────────────────────────────────────────────────
    canvas.addEventListener('click', async (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx   = (e.clientX - rect.left) * (W / rect.width);
        const cy   = (e.clientY - rect.top)  * (H / rect.height);
        const sb   = toSB(cx, cy);

        marker = { cx, cy, sbX: sb.sbX, sbY: sb.sbY };
        drawPitch();

        const data = await apiPost('/api/xg', { x: sb.sbX, y: sb.sbY });
        renderXGResult(data);
    });

    function renderXGResult(data) {
        document.getElementById('xg-placeholder').classList.add('hidden');
        const res = document.getElementById('xg-result');
        res.classList.remove('hidden');

        document.getElementById('xg-val').textContent   = data.xg;
        document.getElementById('xg-pct').textContent   = data.xg_pct + '%';
        document.getElementById('xg-angle').textContent = data.angle + '°';
        document.getElementById('xg-dist').textContent  = data.distance + ' yds';

        const bar = document.getElementById('xg-bar');
        bar.style.width = data.xg_pct + '%';
        bar.className   = 'bar-fill';
        if (data.xg >= 0.3)      bar.classList.add('high');
        else if (data.xg >= 0.1) bar.classList.add('mid');
        else                      bar.classList.add('low');

        document.getElementById('xg-bar-label').textContent = data.xg_pct + '%';
    }

    drawPitch();
    window.drawPitch = drawPitch;
})();
