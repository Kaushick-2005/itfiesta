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
        if (data.eventType === "blackbox") {
            window.location.href = "/blackbox.html";
        } else {
            window.location.href = "/escape.html";
        }
    } else {
        alert("Invalid Team ID ");
    }
});
