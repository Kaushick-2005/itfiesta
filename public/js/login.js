function getApiBaseUrl() {
    const configured = window.__API_BASE_URL || window.API_BASE_URL || "";
    if (configured) return configured;

    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    return isLocal ? "http://localhost:3000" : window.location.origin;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const teamId = document.getElementById("teamId").value;

    const apiBase = getApiBaseUrl();

    const res = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ teamId })
    });

    const data = await res.json();

    if (data.success) {
        // Store teamId in localStorage and sessionStorage for session
        localStorage.setItem("teamId", teamId);
        sessionStorage.setItem("teamId", teamId);
        
        if (data.eventType === "blackbox") {
            // Fetch team data to get current round
            const teamRes = await fetch(`${apiBase}/api/blackbox/team/${teamId}`, {
                credentials: "include"
            });
            const teamData = await teamRes.json();
            const currentRound = teamData.currentRound || 1;
            
            if (currentRound > 3) {
                window.location.href = "/blackbox/leaderboard.html";
            } else {
                window.location.href = `/blackbox/round${currentRound}.html`;
            }
        } else if (data.eventType === "escape") {
            // Fetch team data to get current level
            const teamRes = await fetch(`${apiBase}/api/escape/team/${teamId}`, {
                credentials: "include"
            });
            const teamData = await teamRes.json();
            const currentRound = teamData.currentRound || 1;
            
            if (currentRound > 5) {
                window.location.href = "/escape/result/winner.html";
            } else {
                window.location.href = `/escape/levels/level${currentRound}.html`;
            }
        }
    } else {
        alert("Invalid Team ID ");
    }
});
