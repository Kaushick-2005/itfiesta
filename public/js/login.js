document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const teamId = document.getElementById("teamId").value;

    const res = await fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ teamId })
    });

    const data = await res.json();

    if (data.success) {
        // Store teamId in localStorage and sessionStorage for session
        localStorage.setItem("teamId", teamId);
        sessionStorage.setItem("teamId", teamId);
        
        if (data.eventType === "blackbox") {
            // Fetch team data to get current round
            const teamRes = await fetch(`/api/blackbox/team/${teamId}`);
            const teamData = await teamRes.json();
            const currentRound = teamData.currentRound || 1;
            
            if (currentRound > 3) {
                window.location.href = "/blackbox/leaderboard.html";
            } else {
                window.location.href = `/blackbox/round${currentRound}.html`;
            }
        } else if (data.eventType === "escape") {
            // Fetch team data to get current level
            const teamRes = await fetch(`/api/escape/team/${teamId}`);
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
