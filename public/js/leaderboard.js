/* ==========================================
   LIVE LEADERBOARD SYSTEM
   Auto-refresh every 5 seconds
   ========================================== */

let currentEvent = "escape";
let selectedBatch = "all"; // "all" or specific batch number
let refreshInterval;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadBoard('escape');
    startAutoRefresh();
});

/**
 * Load leaderboard for specific event
 */
function loadBoard(event) {
    currentEvent = event;
    selectedBatch = "all"; // reset to all when switching event
    
    // Update button states
    document.getElementById('escapeBtn').classList.remove('active');
    document.getElementById('blackboxBtn').classList.remove('active');
    document.getElementById(`${event}Btn`).classList.add('active');
    
    updateBatchButtonStates();
    fetchData();
}

/**
 * Show all batches (mixed)
 */
function showMixed() {
    selectedBatch = "all";
    updateBatchButtonStates();
    fetchData();
}

/**
 * Select a specific batch
 */
function selectBatch(batchNumber) {
    selectedBatch = batchNumber;
    updateBatchButtonStates();
    fetchData();
}

function updateBatchButtonStates() {
    const mixedBtn = document.getElementById('mixedBtn');
    if (mixedBtn) {
        mixedBtn.classList.toggle('active', selectedBatch === 'all');
        mixedBtn.textContent = selectedBatch === 'all' ? '✅ Mixed Batches' : '🔄 Mixed Batches';
    }

    // Highlight batch buttons
    const buttons = document.querySelectorAll('.batch-buttons button[data-batch]');
    buttons.forEach(btn => {
        const batch = btn.getAttribute('data-batch');
        btn.classList.toggle('active', String(selectedBatch) === String(batch));
    });
}

/**
 * Fetch leaderboard data from API
 */
async function fetchData() {
    try {
        const isMixed = selectedBatch === 'all';
        const batchQuery = !isMixed ? `&batch=${selectedBatch}` : '';
        const res = await fetch(`/api/leaderboard?event=${currentEvent}&mixed=${isMixed}${batchQuery}`);
        
        if (!res.ok) {
            throw new Error('Failed to fetch leaderboard data');
        }
        
        const data = await res.json();
        renderLeaderboard(data);
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        showError();
    }
}

/**
 * Render leaderboard table
 */
function renderLeaderboard(teams) {
    const tbody = document.getElementById('leaderboardBody');
    const emptyState = document.getElementById('emptyState');
    const batchButtonsContainer = document.getElementById('batchButtons');
    
    if (!teams || teams.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';

    // Build dynamic batch buttons from returned data
    if (batchButtonsContainer) {
        const uniqueBatches = Array.from(new Set(teams.map(t => t.batch).filter(b => b !== null && b !== undefined))).sort((a, b) => a - b);
        batchButtonsContainer.innerHTML = uniqueBatches.map(batchNum => {
            return `<button data-batch="${batchNum}" onclick="selectBatch(${batchNum})">Batch ${batchNum}</button>`;
        }).join('');
        updateBatchButtonStates();
    }
    
    tbody.innerHTML = teams.map((team, index) => {
        const rank = index + 1;
        const rankDisplay = rank <= 3 
            ? `<span class="rank-medal rank-${rank}">${rank}</span>`
            : rank;
        
        // Map status to display
        let statusClass = 'active';
        let statusText = 'Competing';
        
        if (team.status === 'completed') {
            statusClass = 'completed';
            statusText = 'Completed';
        } else if (team.status === 'active') {
            statusClass = 'active';
            statusText = 'In Progress';
        } else if (team.status === 'not_started') {
            statusClass = 'active';
            statusText = 'Registered';
        }
        
        return `
            <tr>
                <td>${rankDisplay}</td>
                <td class="team-name">${escapeHtml(team.teamName)}</td>
                <td><span class="score-badge">${team.totalScore || team.score || 0} pts</span></td>
                <td><span class="batch-badge">Batch ${team.batch || 'N/A'}</span></td>
                <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

/**
 * Format time in seconds to MM:SS
 */
function formatTime(seconds) {
    if (!seconds || seconds === 0) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show error message
 */
function showError() {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
                ⚠️ Failed to load leaderboard. Retrying...
            </td>
        </tr>
    `;
}

/**
 * Start auto-refresh interval
 */
function startAutoRefresh() {
    // Clear existing interval if any
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Refresh every 5 seconds
    refreshInterval = setInterval(() => {
        fetchData();
    }, 5000);
}

/**
 * Stop auto-refresh (useful for debugging)
 */
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
