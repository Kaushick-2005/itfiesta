document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        teamName: document.getElementById("teamName").value,
        leaderName: document.getElementById("leaderName").value,
        leaderMobile: document.getElementById("leaderMobile").value,
        member2: document.getElementById("member2").value,
        member3: document.getElementById("member3").value,
        eventType: document.getElementById("eventType").value
    };

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            const card = document.querySelector(".register-card") || document.querySelector(".auth-card") || document.body;
            card.innerHTML = `
                <div class="success-header">
                    <i class="fas fa-check-circle"></i>
                    <h1>Registration Successful</h1>
                    <p class="subtitle">Save your Team ID to log in</p>
                </div>
                <div class="form-section" style="text-align:center;">
                    <p class="subtitle" style="margin-bottom:8px;">Your Team ID</p>
                    <h2>${result.teamId}</h2>
                    <p class="subtitle">Keep this ID safe. You'll need it to sign in.</p>
                </div>
                <button class="btn-primary" onclick="window.location.href='login.html'" style="margin-top:12px;">
                    <i class="fas fa-sign-in-alt"></i>
                    Go to Login
                </button>
            `;
        } else {
            alert("Registration failed. Please try again.");
        }
    } catch (err) {
        console.error(err);
        alert("Unable to register right now. Please check your connection or try again.");
    }
});
