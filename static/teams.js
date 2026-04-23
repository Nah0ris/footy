/**
 * teams.js — Sortable team leaderboard.
 */

(function () {
    const loadBtn = document.getElementById('teams-load-btn');
    const tbody   = document.getElementById('teams-tbody');
    const sortSel = document.getElementById('teams-sort');
    const orderSel= document.getElementById('teams-order');

    loadBtn.addEventListener('click', loadTeams);

    async function loadTeams() {
        const sort  = sortSel.value;
        const order = orderSel.value;

        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#9ca3af;">Loading...</td></tr>`;

        const data = await apiGet(`/api/teams?sort=${sort}&order=${order}`);
        if (!data.teams) return;

        tbody.innerHTML = data.teams.map((t, i) => {
            const diff      = t.difference;
            const diffClass = diff > 0 ? 'pos-diff' : diff < 0 ? 'neg-diff' : '';
            const diffSign  = diff > 0 ? '+' : '';
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td>${t.team}</td>
                    <td>${t.total_shots}</td>
                    <td>${t.total_goals}</td>
                    <td>${t.total_xg}</td>
                    <td class="${diffClass}">${diffSign}${diff}</td>
                </tr>`;
        }).join('');
    }
})();
