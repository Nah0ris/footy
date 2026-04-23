/**
 * app.js
 * Main controller for UI interactions, panel switching, and global events.
 */

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
});

/**
 * Handle sidebar menu clicks to switch between panels.
 */
function initNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const panels = document.querySelectorAll('.panel');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPanelId = item.getAttribute('data-panel');

            // Update Menu Active State
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            // Switch Panels
            panels.forEach(panel => {
                if (panel.id === targetPanelId) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });

            // Trigger specific panel init logic if needed
            onPanelVisible(targetPanelId);
        });
    });
}

/**
 * Hook for panel-specific initialization when they become visible.
 */
function onPanelVisible(panelId) {
    // We can use this to refresh data or resize canvases if needed
    console.log(`Switched to: ${panelId}`);
    
    if (panelId === 'panel-xg') {
        // Redraw pitch if needed
        if (typeof drawPitch === 'function') drawPitch();
    } else if (panelId === 'panel-xgot') {
        // Redraw goal if needed
        if (typeof drawGoalFrame === 'function') drawGoalFrame('goal-canvas');
    }
}

/**
 * Shared API helper
 */
async function apiPost(url, data) {
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await resp.json();
    } catch (err) {
        console.error(`API Error (${url}):`, err);
        return { error: 'Failed to fetch' };
    }
}

async function apiGet(url) {
    try {
        const resp = await fetch(url);
        return await resp.json();
    } catch (err) {
        console.error(`API Error (${url}):`, err);
        return { error: 'Failed to fetch' };
    }
}
