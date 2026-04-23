/**
 * pitch.js
 * Logic for the interactive pitch canvas in the Shot xG panel.
 */

const PITCH_CANVAS = document.getElementById('pitch-canvas');
const PITCH_CTX = PITCH_CANVAS.getContext('2d');

// StatsBomb Dimensions: 120 x 80
// Canvas Dimensions: 700 x 430 (approx 1.6 aspect ratio)
const SB_WIDTH = 120;
const SB_HEIGHT = 80;

// Draw a half-pitch (attacking third usually)
function drawPitch() {
    const w = PITCH_CANVAS.width;
    const h = PITCH_CANVAS.height;

    // Background
    PITCH_CTX.fillStyle = '#131929';
    PITCH_CTX.fillRect(0, 0, w, h);

    PITCH_CTX.strokeStyle = 'rgba(255,255,255,0.2)';
    PITCH_CTX.lineWidth = 2;

    // Pitch Boundary (right side)
    // We map SB 60-120 to canvas 0-700
    // And SB 0-80 to canvas 0-430
    
    // Draw Goal Line
    line(w, 0, w, h);
    
    // Draw Penalty Area (StatsBomb coords: x=102-120, y=18-62)
    const penX = mapRange(102, 60, 120, 0, w);
    const penYTop = mapRange(18, 0, 80, 0, h);
    const penYBot = mapRange(62, 0, 80, 0, h);
    rect(penX, penYTop, w - penX, penYBot - penYTop);

    // Six Yard Box (StatsBomb: x=114-120, y=30-50)
    const sixX = mapRange(114, 60, 120, 0, w);
    const sixYTop = mapRange(30, 0, 80, 0, h);
    const sixYBot = mapRange(50, 0, 80, 0, h);
    rect(sixX, sixYTop, w - sixX, sixYBot - sixYTop);

    // Goal Frame (Center 40, width 8)
    const goalYTop = mapRange(36, 0, 80, 0, h);
    const goalYBot = mapRange(44, 0, 80, 0, h);
    PITCH_CTX.strokeStyle = '#10b981';
    line(w, goalYTop, w, goalYBot);
}

function line(x1, y1, x2, y2) {
    PITCH_CTX.beginPath();
    PITCH_CTX.moveTo(x1, y1);
    PITCH_CTX.lineTo(x2, y2);
    PITCH_CTX.stroke();
}

function rect(x, y, w, h) {
    PITCH_CTX.strokeRect(x, y, w, h);
}

function mapRange(val, inMin, inMax, outMin, outMax) {
    return (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Click interaction
PITCH_CANVAS.addEventListener('click', async (e) => {
    const rect = PITCH_CANVAS.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Convert Canvas -> StatsBomb (we only show 60-120 x range)
    const sbX = mapRange(cx, 0, PITCH_CANVAS.width, 60, 120);
    const sbY = mapRange(cy, 0, PITCH_CANVAS.height, 0, 80);

    // Draw Marker
    drawPitch();
    PITCH_CTX.fillStyle = '#10b981';
    PITCH_CTX.beginPath();
    PITCH_CTX.arc(cx, cy, 6, 0, Math.PI * 2);
    PITCH_CTX.fill();
    PITCH_CTX.strokeStyle = '#fff';
    PITCH_CTX.stroke();

    // Fetch xG
    const result = await apiPost('/api/xg', { x: sbX, y: sbY });
    displayXGResult(result);
});

function displayXGResult(data) {
    const card = document.getElementById('xg-result');
    card.classList.remove('hidden');

    document.getElementById('xg-val').textContent = data.xg;
    document.getElementById('xg-pct').textContent = data.xg_pct + '%';
    document.getElementById('xg-angle').textContent = data.angle + '°';
    document.getElementById('xg-dist').textContent = data.distance + 'y';

    const bar = document.getElementById('xg-bar');
    bar.style.width = data.xg_pct + '%';
    
    const label = document.getElementById('xg-bar-label');
    label.textContent = `Predicted xG: ${data.xg}`;
}

// Initial draw
drawPitch();
