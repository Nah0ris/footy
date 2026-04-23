/**
 * teams.js
 * Logic for the team leaderboard table.
 */

const TEAMS_BTN = document.getElementById('teams-load-btn');
const TEAMS_TBODY = document.getElementById('teams-tbody');

async function loadTeams() {
    const sort = document.getElementById('teams-sort').value;
    const order = document.getElementById('teams-order').value;

    TEAMS_TBODY.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Loading...</td></tr>';

    const data = await apiGet(`/api/teams?sort=${sort}&order=${order}`);
    if (data.teams) {
        TEAMS_TBODY.innerHTML = data.teams.map((t, i) => {
            const diffClass = t.difference > 0 ? 'positive-diff' : (t.difference < 0 ? 'negative-diff' : '');
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td>${t.team}</td>
                    <td>${t.total_shots}</td>
                    <td>${t.total_goals}</td>
                    <td>${t.total_xg}</td>
                    <td class="${diffClass}">${t.difference > 0 ? '+' : ''}${t.difference}</td>
                </tr>
            `;
        }).join('');
    }
}

TEAMS_BTN.addEventListener('click', loadTeams);
