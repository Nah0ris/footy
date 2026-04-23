/**
 * player.js — Player search (WC 2022 stats) + FUT22 player image in avatar.
 */

(function () {
    const input       = document.getElementById('player-input');
    const suggestions = document.getElementById('player-suggestions');
    const resultDiv   = document.getElementById('player-result');
    let allPlayers    = [];

    // Load WC 2022 player names for autocomplete
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

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !suggestions.contains(e.target))
            suggestions.classList.add('hidden');
    });

    suggestions.addEventListener('click', e => {
        if (e.target.tagName !== 'LI') return;
        input.value = e.target.textContent;
        suggestions.classList.add('hidden');
        loadPlayer(e.target.textContent);
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { suggestions.classList.add('hidden'); loadPlayer(input.value.trim()); }
    });

    // ── Load & Render ────────────────────────────────────────────────────────
    async function loadPlayer(name) {
        if (!name) return;
        const [statsData, futData] = await Promise.all([
            apiGet(`/api/player?name=${encodeURIComponent(name)}`),
            apiGet(`/api/fut_players?q=${encodeURIComponent(name)}`),
        ]);
        if (statsData.error) return;

        resultDiv.classList.remove('hidden');

        // Shot map
        drawGoalFrame('player-goal-canvas', statsData.shots);

        // Player avatar — use FUT22 image if found, else initials
        const avatarEl = document.getElementById('player-avatar');
        const futMatch = futData.players && futData.players.length > 0 ? futData.players[0] : null;

        if (futMatch && futMatch.image) {
            // Replace div with an img
            avatarEl.innerHTML = '';
            avatarEl.style.background = 'transparent';
            avatarEl.style.border = 'none';
            const img = document.createElement('img');
            img.src    = futMatch.image;
            img.alt    = name;
            img.style.cssText = 'width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.4);flex-shrink:0;';
            img.onerror = () => { avatarEl.textContent = initials(name); avatarEl.style.background = 'rgba(255,255,255,0.2)'; };
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = initials(name);
        }

        document.getElementById('player-name-display').textContent = name;
        document.getElementById('player-team-display').textContent  =
            futMatch ? `${futMatch.position} · ${futMatch.club}` : '';

        // Stats rows
        const diff      = statsData.difference;
        const diffClass = diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
        const diffSign  = diff > 0 ? '+' : '';

        const stats = [
            { label: 'Total Shots',        value: statsData.total_shots },
            { label: 'Goals Scored',        value: statsData.total_goals },
            { label: 'Shots on Target',     value: statsData.shots_on_target },
            { label: 'Expected Goals (xG)', value: statsData.total_xg },
            { label: 'xGOT',               value: statsData.total_xgot ?? '—' },
            { label: 'Goals vs xG',         value: `${diffSign}${diff}`, cls: diffClass },
        ];

        if (futMatch) {
            stats.push(
                { label: 'FUT Overall',  value: futMatch.overall },
                { label: 'Shooting',     value: futMatch.shooting },
                { label: 'Pace',         value: futMatch.pace },
            );
        }

        document.getElementById('player-stats-list').innerHTML = stats.map(s => `
            <li class="player-stat-row">
                <span class="player-stat-label">${s.label}</span>
                <span class="player-stat-value ${s.cls || ''}">${s.value}</span>
            </li>
        `).join('');
    }

    function initials(name) {
        return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }
})();
