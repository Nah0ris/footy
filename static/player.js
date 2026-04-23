/**
 * player.js — Player search, autocomplete, stats card, and shot map.
 */

(function () {
    const input       = document.getElementById('player-input');
    const suggestions = document.getElementById('player-suggestions');
    const resultDiv   = document.getElementById('player-result');
    let allPlayers    = [];

    // Load full player list for autocomplete
    apiGet('/api/player').then(data => {
        if (data.players) allPlayers = data.players;
    });

    // Search-as-you-type
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { suggestions.classList.add('hidden'); return; }

        const matches = allPlayers.filter(p => p.toLowerCase().includes(q)).slice(0, 10);
        if (matches.length === 0) { suggestions.classList.add('hidden'); return; }

        suggestions.innerHTML = matches.map(p => `<li>${p}</li>`).join('');
        suggestions.classList.remove('hidden');
    });

    // Dismiss suggestions when clicking outside
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.add('hidden');
        }
    });

    // Select a suggestion
    suggestions.addEventListener('click', e => {
        if (e.target.tagName !== 'LI') return;
        input.value = e.target.textContent;
        suggestions.classList.add('hidden');
        loadPlayer(e.target.textContent);
    });

    // Keyboard: Enter to search
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            suggestions.classList.add('hidden');
            loadPlayer(input.value.trim());
        }
    });

    // ── Load & Render ────────────────────────────────────────────────────────
    async function loadPlayer(name) {
        if (!name) return;
        const data = await apiGet(`/api/player?name=${encodeURIComponent(name)}`);
        if (data.error) return;

        resultDiv.classList.remove('hidden');

        // Shot map
        drawGoalFrame('player-goal-canvas', data.shots);

        // Player card header
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('player-avatar').textContent     = initials;
        document.getElementById('player-name-display').textContent = name;
        document.getElementById('player-team-display').textContent = ''; // API doesn't return team per player

        // Stats list
        const diff      = data.difference;
        const diffClass = diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
        const diffSign  = diff > 0 ? '+' : '';

        const stats = [
            { label: 'Total Shots',        value: data.total_shots },
            { label: 'Goals Scored',       value: data.total_goals },
            { label: 'Shots on Target',    value: data.shots_on_target },
            { label: 'Expected Goals (xG)', value: data.total_xg, mono: true },
            { label: 'xGOT',               value: data.total_xgot ?? '—', mono: true },
            {
                label: 'Goals vs xG (Diff)',
                value: `${diffSign}${diff}`,
                cls: diffClass,
                mono: true
            },
        ];

        document.getElementById('player-stats-list').innerHTML = stats.map(s => `
            <li class="player-stat-row">
                <span class="player-stat-label">${s.label}</span>
                <span class="player-stat-value ${s.cls || ''}">${s.value}</span>
            </li>
        `).join('');
    }
})();
