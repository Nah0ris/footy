/**
 * predictor.js
 * Match Predictor panel — search FUT22 players, build lineups,
 * validate formation rules, run match simulation.
 */

(function () {
    // ── Position groups ──────────────────────────────────────────────────────
    const ROLE = {
        GK:  'GK',
        CB:  'DEF', LB:  'DEF', RB:  'DEF', LWB: 'DEF', RWB: 'DEF',
        CM:  'MID', CAM: 'MID', CDM: 'MID', LM:  'MID', RM:  'MID',
        ST:  'FWD', CF:  'FWD', LW:  'FWD', RW:  'FWD', LF:  'FWD',
    };

    const ROLE_ORDER = ['GK', 'DEF', 'MID', 'FWD'];
    const ROLE_LABEL = { GK: 'Goalkeeper', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };

    // ── State ────────────────────────────────────────────────────────────────
    const lineups = { home: [], away: [] };
    let activeTeam   = 'home'; // which side the search is for
    let searchTimer  = null;

    // ── DOM refs ─────────────────────────────────────────────────────────────
    const homeSide = document.getElementById('pred-home-lineup');
    const awaySide = document.getElementById('pred-away-lineup');
    const searchInput   = document.getElementById('pred-search');
    const searchResults = document.getElementById('pred-search-results');
    const predictBtn    = document.getElementById('pred-btn');
    const errorBox      = document.getElementById('pred-error');
    const resultBox     = document.getElementById('pred-result');
    const homeTabBtn    = document.getElementById('pred-tab-home');
    const awayTabBtn    = document.getElementById('pred-tab-away');

    // ── Tab switching ─────────────────────────────────────────────────────────
    homeTabBtn.addEventListener('click', () => setActiveTeam('home'));
    awayTabBtn.addEventListener('click', () => setActiveTeam('away'));

    function setActiveTeam(team) {
        activeTeam = team;
        homeTabBtn.classList.toggle('pred-tab-active', team === 'home');
        awayTabBtn.classList.toggle('pred-tab-active', team === 'away');
        searchInput.placeholder = `Search player for ${team === 'home' ? 'Home' : 'Away'} team…`;
        searchInput.value = '';
        searchResults.innerHTML = '';
    }

    setActiveTeam('home');

    // ── Player Search ─────────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = searchInput.value.trim();
        if (q.length < 2) { searchResults.innerHTML = ''; return; }
        searchTimer = setTimeout(() => fetchPlayers(q), 250);
    });

    async function fetchPlayers(q) {
        const data = await apiGet(`/api/fut_players?q=${encodeURIComponent(q)}`);
        if (!data.players) return;
        renderSearchResults(data.players);
    }

    function renderSearchResults(players) {
        if (players.length === 0) {
            searchResults.innerHTML = `<div class="pred-no-result">No players found</div>`;
            return;
        }
        searchResults.innerHTML = players.map(p => `
            <div class="pred-player-row" data-player='${JSON.stringify(p).replace(/'/g, "&#39;")}'>
                <img class="pred-player-img" src="${p.image}" alt="${p.name}"
                     onerror="this.src='/static/default_player.png'" />
                <div class="pred-player-info">
                    <span class="pred-player-name">${p.name}</span>
                    <span class="pred-player-meta">${p.position} · ${p.club}</span>
                </div>
                <span class="pred-player-ovr">${p.overall}</span>
            </div>
        `).join('');

        // Bind click
        searchResults.querySelectorAll('.pred-player-row').forEach(row => {
            row.addEventListener('click', () => {
                const player = JSON.parse(row.dataset.player);
                addPlayer(activeTeam, player);
                searchInput.value = '';
                searchResults.innerHTML = '';
            });
        });
    }

    // ── Lineup management ─────────────────────────────────────────────────────
    function addPlayer(team, player) {
        const lineup = lineups[team];

        // Check: not already in lineup
        if (lineup.find(p => p.name === player.name)) {
            showError(`${player.name} is already in the ${team} lineup.`);
            return;
        }

        // Check: max 1 GK
        if (player.position === 'GK' && lineup.filter(p => p.position === 'GK').length >= 1) {
            showError('A team can only have 1 goalkeeper.');
            return;
        }

        // Check: max 11 players
        if (lineup.length >= 11) {
            showError(`${team === 'home' ? 'Home' : 'Away'} team already has 11 players.`);
            return;
        }

        lineup.push(player);
        clearError();
        renderLineup(team);
    }

    function removePlayer(team, name) {
        lineups[team] = lineups[team].filter(p => p.name !== name);
        renderLineup(team);
    }

    function renderLineup(team) {
        const lineup = lineups[team];
        const el     = team === 'home' ? homeSide : awaySide;
        const count  = lineup.length;

        // Group by role
        const groups = { GK: [], DEF: [], MID: [], FWD: [] };
        lineup.forEach(p => groups[ROLE[p.position] || 'MID'].push(p));

        el.innerHTML = `
            <div class="pred-lineup-header">
                <span class="pred-lineup-label">${team === 'home' ? 'Home' : 'Away'} Team</span>
                <span class="pred-lineup-count ${count === 11 ? 'complete' : ''}">${count}/11</span>
            </div>
            ${ROLE_ORDER.map(role => groups[role].length === 0 ? '' : `
                <div class="pred-role-group">
                    <div class="pred-role-label">${ROLE_LABEL[role]}</div>
                    ${groups[role].map(p => `
                        <div class="pred-lineup-card">
                            <img class="pred-lineup-img" src="${p.image}" alt="${p.name}"
                                 onerror="this.style.display='none'" />
                            <div class="pred-lineup-info">
                                <span class="pred-lineup-name">${p.name}</span>
                                <span class="pred-lineup-pos">${p.position}</span>
                            </div>
                            <span class="pred-lineup-ovr">${p.overall}</span>
                            <button class="pred-remove-btn" onclick="removePredPlayer('${team}', '${p.name.replace(/'/g, "\\'")}')">✕</button>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            ${count === 0 ? `<p class="pred-lineup-empty">Search and add players above</p>` : ''}
        `;
    }

    // Expose removePlayer globally for inline onclick
    window.removePredPlayer = removePlayer;

    // ── Validate & Predict ────────────────────────────────────────────────────
    predictBtn.addEventListener('click', async () => {
        clearError();
        resultBox.classList.add('hidden');

        const home = lineups.home;
        const away = lineups.away;

        if (home.length !== 11 || away.length !== 11) {
            showError('Both teams must have exactly 11 players before predicting.');
            return;
        }

        const data = await apiPost('/api/predict_match', { home, away });

        if (data.error) {
            showError(data.error);
            return;
        }

        renderResult(data);
    });

    function renderResult(d) {
        resultBox.classList.remove('hidden');
        document.getElementById('pred-home-xg').textContent = d.home_xg;
        document.getElementById('pred-away-xg').textContent = d.away_xg;

        // Win probability bars
        renderProbBar('pred-home-prob', d.home_win_pct, 'bar-home');
        renderProbBar('pred-draw-prob', d.draw_pct,     'bar-draw');
        renderProbBar('pred-away-prob', d.away_win_pct, 'bar-away');

        document.getElementById('pred-home-prob-val').textContent = d.home_win_pct + '%';
        document.getElementById('pred-draw-prob-val').textContent = d.draw_pct     + '%';
        document.getElementById('pred-away-prob-val').textContent = d.away_win_pct + '%';

        // Likely scorelines
        const scoreList = document.getElementById('pred-scorelines');
        scoreList.innerHTML = d.top_scorelines.map((s, i) => `
            <div class="pred-score-row ${i === 0 ? 'top' : ''}">
                <span class="pred-score-val">${s.score}</span>
                <div class="pred-score-bar-wrap">
                    <div class="pred-score-bar" style="width:${Math.min(s.pct * 4, 100)}%"></div>
                </div>
                <span class="pred-score-pct">${s.pct}%</span>
            </div>
        `).join('');
    }

    function renderProbBar(barId, pct, cls) {
        const el = document.getElementById(barId);
        el.style.width = pct + '%';
        el.className   = `pred-prob-fill ${cls}`;
    }

    // ── Error helpers ──────────────────────────────────────────────────────────
    function showError(msg) { errorBox.textContent = msg; errorBox.classList.remove('hidden'); }
    function clearError()   { errorBox.textContent = ''; errorBox.classList.add('hidden'); }

    // Initial empty renders
    renderLineup('home');
    renderLineup('away');
})();
