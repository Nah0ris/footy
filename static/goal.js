/**
 * goal.js — Goal frame canvas for xGOT panel and player shot map.
 * Goal: y = [36, 44] (8 yards wide), z = [0, 2.44] metres.
 */

// ── Constants ───────────────────────────────────────────────────────────────
const GOAL_SB_Y_MIN  = 36, GOAL_SB_Y_MAX  = 44;
const GOAL_SB_Z_MAX  = 2.44;
const GOAL_PAD_X     = 48;  // canvas px from left/right for posts
const GOAL_PAD_TOP   = 22;  // canvas px from top for crossbar
const GOAL_PAD_BOT   = 8;   // canvas px from bottom for ground

// ── Goal Frame Renderer ─────────────────────────────────────────────────────
function drawGoalFrame(canvasId, shots = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Inner frame coords (where the goal is drawn)
    const fx  = GOAL_PAD_X;
    const fy  = GOAL_PAD_TOP;
    const fw  = W - GOAL_PAD_X * 2;
    const fh  = H - GOAL_PAD_TOP - GOAL_PAD_BOT;

    ctx.clearRect(0, 0, W, H);

    // Background — light grey like a pitch end
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#e8f5e9');
    grad.addColorStop(1, '#c8e6c9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Ground line
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, H - GOAL_PAD_BOT, W, GOAL_PAD_BOT);
    ctx.fillStyle = '#6d9b3a';
    ctx.fillRect(0, H - GOAL_PAD_BOT - 4, W, 4);

    // Net background (inside the frame)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(fx, fy, fw, fh);

    // Net grid lines
    ctx.strokeStyle = 'rgba(180,180,180,0.5)';
    ctx.lineWidth = 0.5;
    const netCols = 14, netRows = 8;
    for (let i = 1; i < netCols; i++) {
        const nx = fx + (fw / netCols) * i;
        ctx.beginPath(); ctx.moveTo(nx, fy); ctx.lineTo(nx, fy + fh); ctx.stroke();
    }
    for (let j = 1; j < netRows; j++) {
        const ny = fy + (fh / netRows) * j;
        ctx.beginPath(); ctx.moveTo(fx, ny); ctx.lineTo(fx + fw, ny); ctx.stroke();
    }

    // Posts & Crossbar (white with dark shadow)
    ctx.shadowColor  = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur   = 4;
    ctx.shadowOffsetX = 2;
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth   = 1;

    const postW = 6;
    // Left post
    ctx.fillRect(fx - postW / 2, fy, postW, fh + GOAL_PAD_BOT);
    // Right post
    ctx.fillRect(fx + fw - postW / 2, fy, postW, fh + GOAL_PAD_BOT);
    // Crossbar
    ctx.fillRect(fx - postW / 2, fy - postW / 2, fw + postW, postW);
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;

    // Shot markers
    shots.forEach(s => {
        if (s.end_y === null || s.end_z === null) return;
        if (s.end_y < GOAL_SB_Y_MIN || s.end_y > GOAL_SB_Y_MAX) return;
        if (s.end_z < 0 || s.end_z > GOAL_SB_Z_MAX) return;

        const px = mapRange(s.end_y, GOAL_SB_Y_MIN, GOAL_SB_Y_MAX, fx, fx + fw);
        const py = mapRange(s.end_z, 0, GOAL_SB_Z_MAX, fy + fh, fy);
        const r  = Math.max(4, (s.xg || 0.05) * 18);

        if (s.outcome === 'Goal') {
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle   = 'rgba(15,121,72,0.75)';
            ctx.fill();
            ctx.strokeStyle = '#0f7948';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        } else {
            const hs = r * 0.6;
            ctx.strokeStyle = 'rgba(192,57,43,0.8)';
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(px - hs, py - hs); ctx.lineTo(px + hs, py + hs);
            ctx.moveTo(px + hs, py - hs); ctx.lineTo(px - hs, py + hs);
            ctx.stroke();
        }
    });
}

// ── Coordinate helpers for goal canvas ─────────────────────────────────────
function canvasToGoalSB(canvas, cx, cy) {
    const W  = canvas.width;
    const H  = canvas.height;
    const fx = GOAL_PAD_X;
    const fy = GOAL_PAD_TOP;
    const fw = W - GOAL_PAD_X * 2;
    const fh = H - GOAL_PAD_TOP - GOAL_PAD_BOT;
    return {
        end_y: mapRange(cx, fx, fx + fw, GOAL_SB_Y_MIN, GOAL_SB_Y_MAX),
        end_z: mapRange(cy, fy + fh, fy, 0, GOAL_SB_Z_MAX),
    };
}

// ── xGOT Panel Interaction ──────────────────────────────────────────────────
(function () {
    const canvas = document.getElementById('goal-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let markerPos = null;

    canvas.addEventListener('click', async (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx   = (e.clientX - rect.left) * (canvas.width  / rect.width);
        const cy   = (e.clientY - rect.top)  * (canvas.height / rect.height);
        const sb   = canvasToGoalSB(canvas, cx, cy);

        if (sb.end_y < GOAL_SB_Y_MIN || sb.end_y > GOAL_SB_Y_MAX) return;
        if (sb.end_z < 0             || sb.end_z > GOAL_SB_Z_MAX)  return;

        markerPos = { cx, cy, ...sb };
        drawGoalFrame('goal-canvas');
        drawXGOTMarker(ctx, cx, cy);

        const data = await apiPost('/api/xgot', { end_y: sb.end_y, end_z: sb.end_z });
        if (data.error) return;
        renderXGOTResult(data, sb.end_y, sb.end_z);
    });

    function drawXGOTMarker(ctx, cx, cy) {
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(26,86,219,0.9)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2;
        ctx.stroke();
    }

    function renderXGOTResult(data, endY, endZ) {
        document.getElementById('xgot-placeholder').classList.add('hidden');
        const res = document.getElementById('xgot-result');
        res.classList.remove('hidden');

        document.getElementById('xgot-val').textContent      = data.xgot;
        document.getElementById('xgot-save-pct').textContent = (100 - data.xgot_pct).toFixed(1) + '%';

        const h = endY < 36 + 8/3 ? 'Left' : (endY < 36 + 16/3 ? 'Center' : 'Right');
        const v = endZ < 1.22 ? 'Low' : 'High';
        document.getElementById('xgot-zone').textContent = `${v} ${h}`;

        const bar = document.getElementById('xgot-bar');
        bar.style.width = data.xgot_pct + '%';
        bar.className   = 'bar-fill';
        if (data.xgot >= 0.7)      bar.classList.add('high');
        else if (data.xgot >= 0.4) bar.classList.add('mid');
        else                        bar.classList.add('low');

        document.getElementById('xgot-bar-label').textContent = data.xgot_pct + '%';
    }

    drawGoalFrame('goal-canvas');
    window.drawGoalFrame = drawGoalFrame;
})();