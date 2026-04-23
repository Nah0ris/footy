/**
 * app.js — Navigation controller + shared utilities.
 */

// ── Sidebar Toggle ─────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const mainEl  = document.getElementById('main');
const burger  = document.getElementById('hamburger');

burger.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainEl.classList.toggle('sidebar-collapsed');
});

// ── Panel Switching ────────────────────────────────────────────────────────
const menuItems = document.querySelectorAll('.menu-item');
const panels    = document.querySelectorAll('.panel');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        menuItems.forEach(mi => mi.classList.remove('active'));
        panels.forEach(p  => p.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(item.dataset.panel).classList.add('active');
    });
});

// ── Shared API Helpers ─────────────────────────────────────────────────────
async function apiPost(url, data) {
    const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
    });
    return resp.json();
}

async function apiGet(url) {
    const resp = await fetch(url);
    return resp.json();
}

// ── Shared Coord Mapper ────────────────────────────────────────────────────
function mapRange(val, inMin, inMax, outMin, outMax) {
    return (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
