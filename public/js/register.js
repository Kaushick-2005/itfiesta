const eventSelect = document.getElementById("eventType");
const registrationStatus = document.getElementById("registrationStatus");
const registerButton = document.getElementById("registerSubmit");

async function loadAvailableEvents() {
    try {
        const res = await fetch(`/api/events/active?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
            throw new Error("Failed to load events");
        }
        const events = await res.json();
        const activeEvents = Array.isArray(events)
            ? events.filter(evt => evt && evt.isActive !== false)
            : [];

        renderEventOptions(activeEvents);
    } catch (err) {
        renderEventOptions([]);
        showRegistrationStatus("Unable to load events. Please refresh or try again.");
    }
}

function renderEventOptions(events) {
    eventSelect.innerHTML = "";

    if (!events.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Registrations closed";
        option.disabled = true;
        eventSelect.appendChild(option);

        eventSelect.disabled = true;
        registerButton.disabled = true;
        showRegistrationStatus("Registrations are currently closed.");
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Event";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.hidden = true;
    eventSelect.appendChild(placeholder);

    events.forEach(event => {
        const option = document.createElement("option");
        option.value = event.key;
        option.textContent = event.title;
        eventSelect.appendChild(option);
    });

    eventSelect.disabled = false;
    registerButton.disabled = false;
    hideRegistrationStatus();
}

function showRegistrationStatus(message) {
    if (!registrationStatus) return;
    registrationStatus.textContent = message;
    registrationStatus.hidden = false;
}

function hideRegistrationStatus() {
    if (!registrationStatus) return;
    registrationStatus.hidden = true;
}

loadAvailableEvents();

document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (eventSelect.disabled || !eventSelect.value) {
        alert("Registrations are currently closed.");
        return;
    }

    const data = {
        teamName: document.getElementById("teamName").value,
        leaderName: document.getElementById("leaderName").value,
        leaderMobile: document.getElementById("leaderMobile").value,
        member2: document.getElementById("member2").value,
        member3: document.getElementById("member3").value,
        eventType: eventSelect.value
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
