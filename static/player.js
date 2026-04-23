/**
 * player.js
 * Search and stats for individual players.
 */

const PLAYER_INPUT = document.getElementById('player-input');
const SUGGESTIONS = document.getElementById('player-suggestions');
let allPlayers = [];

// Load player list for autocomplete
async function initPlayerSearch() {
    const data = await apiGet('/api/player');
    if (data.players) {
        allPlayers = data.players;
    }
}

PLAYER_INPUT.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    if (val.length < 2) {
        SUGGESTIONS.classList.add('hidden');
        return;
    }

    const matches = allPlayers.filter(p => p.toLowerCase().includes(val)).slice(0, 10);
    if (matches.length > 0) {
        SUGGESTIONS.innerHTML = matches.map(p => `<li>${p}</li>`).join('');
        SUGGESTIONS.classList.remove('hidden');
    } else {
        SUGGESTIONS.classList.add('hidden');
    }
});

SUGGESTIONS.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
        const name = e.target.textContent;
        PLAYER_INPUT.value = name;
        SUGGESTIONS.classList.add('hidden');
        loadPlayerData(name);
    }
});

async function loadPlayerData(name) {
    const data = await apiGet(`/api/player?name=${encodeURIComponent(name)}`);
    if (data.error) return;

    const resultDiv = document.getElementById('player-result');
    resultDiv.classList.remove('hidden');

    // Stats Grid
    const grid = document.getElementById('player-stat-grid');
    const diffClass = data.difference >= 0 ? 'positive' : 'negative';
    
    grid.innerHTML = `
        <div class="stat-card">
            <span class="stat-card-label">Shots</span>
            <span class="stat-card-value">${data.total_shots}</span>
        </div>
        <div class="stat-card highlight">
            <span class="stat-card-label">Goals</span>
            <span class="stat-card-value">${data.total_goals}</span>
        </div>
        <div class="stat-card">
            <span class="stat-card-label">xG</span>
            <span class="stat-card-value">${data.total_xg}</span>
        </div>
        <div class="stat-card">
            <span class="stat-card-label">xGOT</span>
            <span class="stat-card-value">${data.total_xgot || 0}</span>
        </div>
        <div class="stat-card">
            <span class="stat-card-label">Difference</span>
            <span class="stat-card-value ${diffClass}">${data.difference > 0 ? '+' : ''}${data.difference}</span>
        </div>
    `;

    // Draw Shot Map on Player Goal Canvas
    drawGoalFrame('player-goal-canvas', data.shots);
}

initPlayerSearch();
