/**
 * goal.js
 * Logic for the interactive goal canvas in the Shot xGOT panel.
 */

function drawGoalFrame(canvasId, shots = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // StatsBomb Goal: y=[36, 44] (width 8), z=[0, 2.44]
    
    // Clear
    ctx.fillStyle = '#131929';
    ctx.fillRect(0, 0, w, h);

    // Draw Posts & Crossbar
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 8;
    ctx.strokeRect(40, 20, w - 80, h - 20); // Border frame
    
    // Bottom "Ground" line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 2);
    ctx.lineTo(w, h - 2);
    ctx.stroke();

    // Draw existing shots (for player map)
    shots.forEach(s => {
        if (s.end_y === null || s.end_z === null) return;
        
        const sx = mapRange(s.end_y, 36, 44, 40, w - 40);
        const sz = mapRange(s.end_z, 0, 2.44, h - 2, 20);
        
        ctx.beginPath();
        if (s.outcome === 'Goal') {
            ctx.fillStyle = '#10b981';
            ctx.arc(sx, sz, 4 + (s.xg * 10), 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            const size = 3 + (s.xg * 5);
            ctx.moveTo(sx - size, sz - size);
            ctx.lineTo(sx + size, sz + size);
            ctx.moveTo(sx + size, sz - size);
            ctx.lineTo(sx - size, sz + size);
            ctx.stroke();
        }
    });
}

const GOAL_CANVAS = document.getElementById('goal-canvas');
if (GOAL_CANVAS) {
    GOAL_CANVAS.addEventListener('click', async (e) => {
        const rect = GOAL_CANVAS.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        // Constraint to within frame
        const w = GOAL_CANVAS.width;
        const h = GOAL_CANVAS.height;
        
        // StatsBomb conversion
        // y: [36, 44], z: [0, 2.44]
        const sbY = mapRange(cx, 40, w - 40, 36, 44);
        const sbZ = mapRange(cy, h - 2, 20, 0, 2.44);

        if (sbY < 36 || sbY > 44 || sbZ < 0 || sbZ > 2.44) return;

        // Draw Dot
        drawGoalFrame('goal-canvas');
        const ctx = GOAL_CANVAS.getContext('2d');
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Fetch xGOT
        const result = await apiPost('/api/xgot', { end_y: sbY, end_z: sbZ });
        displayXGOTResult(result, sbY, sbZ);
    });
}

function displayXGOTResult(data, y, z) {
    const card = document.getElementById('xgot-result');
    card.classList.remove('hidden');

    document.getElementById('xgot-val').textContent = data.xgot;
    document.getElementById('xgot-pct').textContent = data.xgot_pct + '%';
    
    // Simple zone text
    let h = (y < 36 + 8/3) ? 'Left' : (y < 36 + 16/3 ? 'Center' : 'Right');
    let v = (z < 1.22) ? 'Low' : 'High';
    document.getElementById('xgot-zone').textContent = `${v} ${h}`;

    const bar = document.getElementById('xgot-bar');
    bar.style.width = data.xgot_pct + '%';
    document.getElementById('xgot-bar-label').textContent = `Predicted xGOT: ${data.xgot}`;
}

drawGoalFrame('goal-canvas');
