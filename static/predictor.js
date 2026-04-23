/**
 * predictor.js
 * Match Predictor — country selector, squad list, search fallback, lineup builder.
 */

(function () {
    const ROLE_ORDER = ['GK','DEF','MID','FWD'];
    const ROLE_LABEL = {GK:'Goalkeeper', DEF:'Defenders', MID:'Midfielders', FWD:'Forwards'};

    const lineups    = { home: [], away: [] };
    let activeTeam   = 'home';
    let searchTimer  = null;

    // DOM
    const homeSide      = document.getElementById('pred-home-lineup');
    const awaySide      = document.getElementById('pred-away-lineup');
    const searchInput   = document.getElementById('pred-search');
    const searchResults = document.getElementById('pred-search-results');
    const predictBtn    = document.getElementById('pred-btn');
    const errorBox      = document.getElementById('pred-error');
    const resultBox     = document.getElementById('pred-result');
    const homeTabBtn    = document.getElementById('pred-tab-home');
    const awayTabBtn    = document.getElementById('pred-tab-away');
    const countrySelect = document.getElementById('pred-country');
    const loadSquadBtn  = document.getElementById('pred-load-squad');
    const squadListEl   = document.getElementById('pred-squad-list');

    // ── Load countries into dropdown ──────────────────────────────────────────
    apiGet('/api/countries').then(d => {
        if (!d.countries) return;
        d.countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            countrySelect.appendChild(opt);
        });
    });

    // ── Tab switching ─────────────────────────────────────────────────────────
    homeTabBtn.addEventListener('click', () => setActiveTeam('home'));
    awayTabBtn.addEventListener('click', () => setActiveTeam('away'));

    function setActiveTeam(team) {
        activeTeam = team;
        homeTabBtn.classList.toggle('pred-tab-active', team === 'home');
        awayTabBtn.classList.toggle('pred-tab-active', team === 'away');
        searchInput.placeholder = `Search player for ${team === 'home' ? 'Home' : 'Away'} team...`;
        searchInput.value = '';
        searchResults.innerHTML = '';
        squadListEl.classList.add('hidden');
    }
    setActiveTeam('home');

    // ── Load Squad ────────────────────────────────────────────────────────────
    loadSquadBtn.addEventListener('click', async () => {
        const country = countrySelect.value;
        if (!country) { showError('Select a country first.'); return; }
        clearError();
        const d = await apiGet(`/api/squad?country=${encodeURIComponent(country)}`);
        if (!d.players || d.players.length === 0) {
            showError(`No players found for ${country}.`); return;
        }
        renderSquadList(d.players);
    });

    function renderSquadList(players) {
        squadListEl.classList.remove('hidden');
        squadListEl.innerHTML = `
            <div class="pred-squad-title">Click a player to add to ${activeTeam === 'home' ? 'Home' : 'Away'} team</div>
            <div class="pred-squad-grid">
                ${players.map(p => `
                    <div class="pred-squad-card" data-player='${JSON.stringify(p).replace(/'/g,"&#39;")}'>
                        <div class="pred-squad-avatar">${initials(p.name)}</div>
                        <div class="pred-squad-name">${p.name}</div>
                        <div class="pred-squad-meta">${p.position} · ${p.overall}</div>
                    </div>
                `).join('')}
            </div>
        `;
        squadListEl.querySelectorAll('.pred-squad-card').forEach(card => {
            card.addEventListener('click', () => {
                addPlayer(activeTeam, JSON.parse(card.dataset.player));
            });
        });
    }

    // ── Player Search (fallback) ──────────────────────────────────────────────
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
            <div class="pred-player-row" data-player='${JSON.stringify(p).replace(/'/g,"&#39;")}'>
                <div class="pred-player-avatar-sm">${initials(p.name)}</div>
                <div class="pred-player-info">
                    <span class="pred-player-name">${p.name}</span>
                    <span class="pred-player-meta">${p.position} · ${p.club}</span>
                </div>
                <span class="pred-player-ovr">${p.overall}</span>
            </div>
        `).join('');
        searchResults.querySelectorAll('.pred-player-row').forEach(row => {
            row.addEventListener('click', () => {
                addPlayer(activeTeam, JSON.parse(row.dataset.player));
                searchInput.value = '';
                searchResults.innerHTML = '';
            });
        });
    }

    // ── Lineup management ─────────────────────────────────────────────────────
    function addPlayer(team, player) {
        const lineup = lineups[team];
        if (lineup.find(p => p.name === player.name)) {
            showError(`${player.name} is already in the ${team} lineup.`); return;
        }
        if (player.position === 'GK' && lineup.filter(p => p.position === 'GK').length >= 1) {
            showError('Only 1 goalkeeper allowed per team.'); return;
        }
        if (lineup.length >= 11) {
            showError(`${team === 'home' ? 'Home' : 'Away'} team already has 11 players.`); return;
        }
        lineup.push(player);
        clearError();
        renderLineup(team);
    }

    function removePlayer(team, name) {
        lineups[team] = lineups[team].filter(p => p.name !== name);
        renderLineup(team);
    }
    window.removePredPlayer = removePlayer;

    function renderLineup(team) {
        const lineup = lineups[team];
        const el     = team === 'home' ? homeSide : awaySide;
        const count  = lineup.length;
        const groups = { GK:[], DEF:[], MID:[], FWD:[] };
        lineup.forEach(p => groups[p.position].push(p));

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
                            <div class="pred-lineup-avatar">${initials(p.name)}</div>
                            <div class="pred-lineup-info">
                                <span class="pred-lineup-name">${p.name}</span>
                                <span class="pred-lineup-pos">${p.position}</span>
                            </div>
                            <span class="pred-lineup-ovr">${p.overall}</span>
                            <button class="pred-remove-btn" onclick="removePredPlayer('${team}','${p.name.replace(/'/g,"\\'")}')">&#x2715;</button>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            ${count === 0 ? `<p class="pred-lineup-empty">Select a country and load squad, or search players</p>` : ''}
        `;
    }

    // ── Validate & Predict ────────────────────────────────────────────────────
    predictBtn.addEventListener('click', async () => {
        clearError(); resultBox.classList.add('hidden');
        if (lineups.home.length !== 11 || lineups.away.length !== 11) {
            showError('Both teams must have exactly 11 players.'); return;
        }
        const data = await apiPost('/api/predict_match', { home: lineups.home, away: lineups.away });
        if (data.error) { showError(data.error); return; }
        renderResult(data);
    });

    function renderResult(d) {
        resultBox.classList.remove('hidden');
        document.getElementById('pred-home-xg').textContent = d.home_xg;
        document.getElementById('pred-away-xg').textContent = d.away_xg;
        setProbBar('pred-home-prob', d.home_win_pct, 'bar-home');
        setProbBar('pred-draw-prob', d.draw_pct,     'bar-draw');
        setProbBar('pred-away-prob', d.away_win_pct, 'bar-away');
        document.getElementById('pred-home-prob-val').textContent = d.home_win_pct + '%';
        document.getElementById('pred-draw-prob-val').textContent = d.draw_pct     + '%';
        document.getElementById('pred-away-prob-val').textContent = d.away_win_pct + '%';
        document.getElementById('pred-scorelines').innerHTML = d.top_scorelines.map((s,i) => `
            <div class="pred-score-row ${i===0?'top':''}">
                <span class="pred-score-val">${s.score}</span>
                <div class="pred-score-bar-wrap"><div class="pred-score-bar" style="width:${Math.min(s.pct*4,100)}%"></div></div>
                <span class="pred-score-pct">${s.pct}%</span>
            </div>
        `).join('');
    }

    function setProbBar(id, pct, cls) {
        const el = document.getElementById(id);
        el.style.width = pct + '%';
        el.className = `pred-prob-fill ${cls}`;
    }

    function showError(msg) { errorBox.textContent = msg; errorBox.classList.remove('hidden'); }
    function clearError()   { errorBox.textContent = ''; errorBox.classList.add('hidden'); }

    function initials(name) {
        return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }

    renderLineup('home');
    renderLineup('away');
})();
