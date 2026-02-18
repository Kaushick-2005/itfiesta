const eventSelect = document.getElementById("eventType");
const registrationStatus = document.getElementById("registrationStatus");
const registerButton = document.getElementById("registerSubmit");

function getApiBaseUrl() {
    const configured = window.__API_BASE_URL || window.API_BASE_URL || "";
    if (configured) return configured;

    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    return isLocal ? "http://localhost:3000" : window.location.origin;
}

async function loadAvailableEvents() {
    try {
        const res = await fetch(`${getApiBaseUrl()}/api/events/active?_=${Date.now()}`, { cache: "no-store" });
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

    const leaderMobileInput = document.getElementById("leaderMobile");
    const leaderMobile = String((leaderMobileInput && leaderMobileInput.value) || "").replace(/\D/g, "");
    if (!/^\d{10}$/.test(leaderMobile)) {
        alert("Leader mobile number must be exactly 10 digits.");
        if (leaderMobileInput) {
            leaderMobileInput.focus();
        }
        return;
    }

    const data = {
        teamName: document.getElementById("teamName").value,
        leaderName: document.getElementById("leaderName").value,
        leaderMobile,
        member2: document.getElementById("member2").value,
        member3: document.getElementById("member3").value,
        eventType: eventSelect.value
    };

    try {
        const res = await fetch(`${getApiBaseUrl()}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            const safeTeamId = String(result.teamId || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const card = document.querySelector(".register-card") || document.querySelector(".auth-card") || document.body;
            card.innerHTML = `
                <div class="success-header">
                    <i class="fas fa-check-circle"></i>
                    <h1>Registration Successful</h1>
                    <p class="subtitle">Save your Team ID to log in</p>
                </div>
                <div class="form-section" style="text-align:center;">
                    <p class="subtitle" style="margin-bottom:8px;">Your Team ID</p>
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:nowrap;">
                        <h2 id="teamIdValue" style="margin:0;display:inline-block;width:auto;max-width:calc(100% - 56px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:12px 14px;">${safeTeamId}</h2>
                        <button id="copyTeamIdBtn" type="button" title="Copy Team ID"
                            style="border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.06);color:#fff;border-radius:8px;padding:8px 10px;cursor:pointer;line-height:1;display:inline-flex;align-items:center;justify-content:center;">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <p class="subtitle">Keep this ID safe. You'll need it to sign in.</p>
                    <p id="copyStatusMsg" class="subtitle" style="margin-top:6px;min-height:20px;font-size:12px;"></p>
                </div>
                <button class="btn-primary" onclick="window.location.href='login.html'" style="margin-top:12px;">
                    <i class="fas fa-sign-in-alt"></i>
                    Go to Login
                </button>
            `;

            const copyBtn = document.getElementById('copyTeamIdBtn');
            const copyStatus = document.getElementById('copyStatusMsg');
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(String(result.teamId || ''));
                        if (copyStatus) copyStatus.textContent = 'Team ID copied';
                    } catch (copyErr) {
                        if (copyStatus) copyStatus.textContent = '⚠️ Copy failed. Please copy manually.';
                    }
                });
            }
        } else {
            alert(result.message || "Registration failed. Please try again.");
        }
    } catch (err) {
        console.error(err);
        alert("Unable to register right now. Please check your connection or try again.");
    }
});
