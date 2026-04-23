/**
 * zones.js
 * Goal frame heatmap showing conversion rates per zone.
 */

const ZONES_BTN = document.getElementById('zones-load-btn');
const ZONES_CANVAS = document.getElementById('zones-canvas');

async function loadZones() {
    const data = await apiGet('/api/zones');
    if (!data.zones) return;

    const ctx = ZONES_CANVAS.getContext('2d');
    const w = ZONES_CANVAS.width;
    const h = ZONES_CANVAS.height;

    // Clear and draw base frame
    drawGoalFrame('zones-canvas');

    const zone_w = (w - 80) / 3;
    const zone_h = (h - 20) / 2;

    const zones_map = {
        'top_left':     { x: 40, y: 20 },
        'top_center':   { x: 40 + zone_w, y: 20 },
        'top_right':    { x: 40 + 2 * zone_w, y: 20 },
        'bottom_left':  { x: 40, y: 20 + zone_h },
        'bottom_center': { x: 40 + zone_w, y: 20 + zone_h },
        'bottom_right': { x: 40 + 2 * zone_w, y: 20 + zone_h }
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const [key, pos] of Object.entries(zones_map)) {
        const zoneData = data.zones[key] || { conversion: 0, total: 0, goals: 0 };
        
        // Heat color (opacity based on conversion)
        const alpha = Math.min(zoneData.conversion / 50, 0.6); // Cap at 0.6 alpha
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.fillRect(pos.x, pos.y, zone_w, zone_h);

        // Text info
        ctx.fillStyle = '#fff';
        ctx.font = '700 1.2rem "Inter"';
        ctx.fillText(`${zoneData.conversion}%`, pos.x + zone_w/2, pos.y + zone_h/2 - 10);
        
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '500 0.7rem "JetBrains Mono"';
        ctx.fillText(`${zoneData.goals} / ${zoneData.total} shots`, pos.x + zone_w/2, pos.y + zone_h/2 + 15);
        
        // Border for the zone
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x, pos.y, zone_w, zone_h);
    }

    document.getElementById('zones-note').textContent = "Conversion rate = (Goals / Shots on Target) * 100";
}

ZONES_BTN.addEventListener('click', loadZones);
