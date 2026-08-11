// --- Configuration ---
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';
const MAX_DISTANCE_METERS = 15000;

// --- DOM Elements ---
const domElements = {
    stationsList: document.getElementById('stations-list'),
    reportsFeed: document.getElementById('reports-feed'),
    reportForm: document.getElementById('report-form'),
    stats: {
        tracked: document.getElementById('stat-tracked'),
        reportedToday: document.getElementById('stat-reported'),
        fixedThisWeek: document.getElementById('stat-fixed')
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();

    // 1. Fetch stats independently if any stat container exists on this page
    if (domElements.stats.tracked || domElements.stats.reportedToday || domElements.stats.fixedThisWeek) {
        fetchStats();
    }

    // 2. Only run dashboard map/feed logic if those elements exist
    if (domElements.stationsList && domElements.reportsFeed) {
        initDashboard();
    }

    // 3. Listen for form submissions (if the form exists on this page)
    if (domElements.reportForm) {
        domElements.reportForm.addEventListener('submit', handleReportSubmit);
    }

    // 4. Init Auth Logic (if we are on the auth page)
    initAuth();
});

async function checkAuthStatus() {
    const token = localStorage.getItem('voltfix_token');
    const authBox = document.getElementById('auth-nav-box');
    const adminPanel = document.getElementById('admin-panel');

    if (adminPanel) {
        adminPanel.style.display = 'none';
    }

    if (!token || !authBox) {
        return;
    }

    let user;
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            credentials: 'include',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            localStorage.removeItem('voltfix_token');
            localStorage.removeItem('voltfix_user');
            return;
        }

        const result = await response.json();
        user = result.data;
        localStorage.setItem('voltfix_user', JSON.stringify(user));
    } catch (error) {
        console.error('Auth verification failed:', error);
        localStorage.removeItem('voltfix_token');
        localStorage.removeItem('voltfix_user');
        return;
    }

    if (token && user && authBox) {
        if (user.role === 'admin') {
            const adminStuff = document.getElementById('admin-panel');
            adminStuff.style.display = "block"

            if (adminStuff) {
                const mainElement = document.querySelector('main');
                if (mainElement) mainElement.append(adminStuff);
                adminStuff.style.display = "block";
            }

            try {
                const reportResponse = await fetch(`${API_BASE_URL}/reports`);
                if (!reportResponse.ok) throw new Error('Failed to fetch reports');

                const responseResult = await reportResponse.json();
                const reportsData = responseResult.data || responseResult || [];

                let faultReportsCounter = 0;
                let numberOfReports = 0;
                let queueReports = ``;

                reportsData.forEach((e) => {
                    if (e.status !== 'resolved' && e.status !== 'dismissed' && e.status !== 'closed') {
                        numberOfReports++;
                        faultReportsCounter++;
                        const timeBefore = formatTimeAgo(e.createdAt);

                        queueReports += `<div class="queue-item" data-report-id="${e._id}">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${e.stationName}</strong>
                                    <p style="font-size: 0.8rem; color: var(--accent-fault); margin-top: 2px;">Issue: ${e.issueType}</p>
                                </div>
                                <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #64748b;">${timeBefore}</span>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">"${e.description}"</p>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button type="button" class="btn-action-sm btn-action-live" onclick="resolveReport('${e._id}', 'available')">Mark Fixed</button>
                                <button type="button" class="btn-action-sm btn-action-fault" onclick="resolveReport('${e._id}', 'fault')">Flag Station Fault</button>
                                <button type="button" class="btn-action-sm btn-action-dim" onclick="dismissReport('${e._id}')">Dismiss</button>
                            </div>
                        </div>`;
                    }
                });

                if (typeof updateSystemStats === 'function') await updateSystemStats();

                const adminStatFaults = document.getElementById('admin-stat-faults');
                if (adminStatFaults) adminStatFaults.innerText = faultReportsCounter;

                const queueContainer = document.getElementById('admin-queue-container');
                if (queueContainer) queueContainer.innerHTML = queueReports;

                const numberOfReportsDisplay = document.getElementById('numberOfReports');
                if (numberOfReportsDisplay) numberOfReportsDisplay.innerText = `${numberOfReports} Open`;

                const adminInfoDisplay = document.getElementById('admin-info');
                if (adminInfoDisplay) {
                    adminInfoDisplay.innerHTML = `<span class="status-dot" style="background: var(--accent-volt); box-shadow: 0 0 8px var(--accent-volt);"></span> Admin: ${user.name || user.email}`;
                }

                setupAdminForm(token);

            } catch (error) {
                console.error("Admin Dashboard Error:", error);
            }
        }

        // --- GLOBAL HELPER FUNCTIONS ---
        // (These must be attached to 'window' so inline onclick attributes can access them)
        window.resolveReport = async function (reportId, newStatus) {
            const item = document.querySelector(`[data-report-id="${reportId}"]`);
            if (item) {
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';
                setTimeout(() => {
                    item.remove();
                    const counterElement = document.getElementById('numberOfReports');
                    if (counterElement) {
                        const currentCount = parseInt(counterElement.innerText) || 0;
                        counterElement.innerText = `${Math.max(0, currentCount - 1)} Open`;
                    }
                }, 400);
            }

            await fetch(`${API_BASE_URL}/reports/${reportId}/resolve`, {
                method: "PATCH",
                credentials: 'include',
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ stationStatus: newStatus })
            });

            if (typeof updateSystemStats === 'function') await updateSystemStats();
        };

        window.dismissReport = async function (reportId) {
            const item = document.querySelector(`[data-report-id="${reportId}"]`);
            if (item) {
                item.remove();
                const counterElement = document.getElementById('numberOfReports');
                if (counterElement) {
                    const currentCount = parseInt(counterElement.innerText) || 0;
                    counterElement.innerText = `${Math.max(0, currentCount - 1)} Open`;
                }
            }

            await fetch(`${API_BASE_URL}/reports/${reportId}/dismiss`, {
                method: "PATCH",
                credentials: 'include',
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            });
        };

        // --- GLOBAL UI UPDATES ---
        const firstName = user.name ? user.name.split(' ')[0] : 'Profile';

        authBox.innerHTML = `
            <div class="auth-user-container">
                <a href="#profile" class="profile-link">
                    <span class="profile-icon">👤</span> 
                    ${firstName}
                </a>
                <button id="logout-btn" class="logout-btn">Logout</button>
            </div>
        `;

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('voltfix_token');
                localStorage.removeItem('voltfix_user');
                window.location.reload();
            });
        }
    }
}

function setupAdminForm(token) {
    const addStationForm = document.getElementById('admin-add-station-form');
    if (!addStationForm) return;

    addStationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formStatus = document.getElementById('admin-form-status');
        const submitBtn = document.getElementById('admin-add-btn');

        const name = document.getElementById('admin-station-name').value.trim();
        const address = document.getElementById('admin-station-address').value.trim();
        const network = document.getElementById('admin-station-network').value.trim();
        const status = document.getElementById('admin-station-status').value;
        const connectors = document.getElementById('admin-station-connectors').value.split(',').map(c => c.trim());

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding Station...';

            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();

            if (!geoData.length) throw new Error("Could not find coordinates for this address.");

            const lat = parseFloat(geoData[0].lat);
            const lng = parseFloat(geoData[0].lon);

            const payload = {
                name, address, connectors, status, network,
                location: { type: "Point", coordinates: [lng, lat] }
            };

            const res = await fetch(`${API_BASE_URL}/stations/create`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                formStatus.textContent = 'Station added successfully!';
                formStatus.className = 'form-status';
                addStationForm.reset();
                document.getElementById('admin-station-network').value = "Voltfix";
                if (typeof updateSystemStats === 'function') updateSystemStats();
            } else {
                const data = await res.json();
                formStatus.textContent = data.message || 'Error adding station.';
                formStatus.className = 'form-status is-error';
            }
        } catch (err) {
            console.error(err);
            formStatus.textContent = err.message || 'Failed to connect to backend server.';
            formStatus.className = 'form-status is-error';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '+ Add Station to Network';
        }
    });
}

// FIX: New helper function to dynamically fetch and update global stats
async function updateSystemStats() {
    try {
        const allStationsResponse = await fetch(`${API_BASE_URL}/stations/literallyAll`);
        const allStationsResult = await allStationsResponse.json();
        const allStationsResultData = allStationsResult.data || allStationsResult || [];

        if (allStationsResultData.length === 0) return;

        let faultyStationsCounter = 0;
        allStationsResultData.forEach((e) => {
            if (e.status === 'fault') {
                faultyStationsCounter++;
            }
        });

        const totalStations = document.getElementById('admin-stat-total');
        if (totalStations) {
            totalStations.innerText = allStationsResultData.length;
        }

        const opDisplay = document.getElementById('operationalPercentage');
        if (opDisplay) {
            const percentageOperational = (1 - (faultyStationsCounter / allStationsResultData.length)) * 100;
            opDisplay.innerText = `${percentageOperational.toFixed(2)}% Operational`;
        }
    } catch (error) {
        console.error("Failed to update system stats:", error);
    }
}

async function initDashboard() {
    fetchReports();

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchStations(latitude, longitude);
            },
            (error) => {
                console.warn("Geolocation denied or failed:", error.message);
                domElements.stationsList.innerHTML = '<li>Please enable location services to see nearby stations.</li>';
            }
        );
    } else {
        domElements.stationsList.innerHTML = '<li>Geolocation is not supported by your browser.</li>';
    }
}

// --- API Calls & Rendering ---

async function fetchStations(lat, lng) {
    try {
        domElements.stationsList.innerHTML = '<li>Loading nearby stations...</li>';

        const url = `${API_BASE_URL}/stations/all?latitude=${lat}&longitude=${lng}&maxDistance=${MAX_DISTANCE_METERS}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            renderStations(result.data);
            const chips = document.querySelectorAll('.chip');
            chips.forEach((chip) => {
                chip.addEventListener('click', () => {
                    const element = document.querySelectorAll('.is-active');
                    element.forEach((e) => e.classList.remove('is-active'));
                    chip.classList.add('is-active');

                    const filter = chip.getAttribute('data-filter');
                    const allStations = result.data;

                    if (filter === 'all') {
                        renderStations(allStations);
                    } else {
                        const filteredStations = allStations.filter((station) => station.status === filter);
                        renderStations(filteredStations);
                    }
                });
            });
        } else {
            domElements.stationsList.innerHTML = '<li>No stations found nearby.</li>';
        }
    } catch (error) {
        console.error('Error fetching stations:', error);
        domElements.stationsList.innerHTML = '<li>Error loading stations.</li>';
    }
}

function renderStations(stations) {
    domElements.stationsList.innerHTML = '';

    if (stations.length === 0) {
        domElements.stationsList.innerHTML = '<p class="feed-empty">No stations found nearby.</p>';
        return;
    }

    const statusConfig = {
        'available': { class: 'status--available', text: 'Available' },
        'in-use': { class: 'status--in-use', text: 'In Use' },
        'fault': { class: 'status--fault', text: 'Fault' }
    };

    stations.forEach(station => {
        const card = document.createElement('div');
        card.className = 'station-card';

        const currentStatus = statusConfig[station.status] || statusConfig['available'];
        const connectorsHTML = station.connectors && station.connectors.length
            ? station.connectors.map(c => `<span class="connector-tag">${c}</span>`).join('')
            : '<span class="connector-tag">Standard</span>';

        card.innerHTML = `
      <div class="station-card-top">
        <h3>${station.name}</h3>
        <span class="status ${currentStatus.class}">
          <span class="status-dot"></span>
          ${currentStatus.text}
        </span>
      </div>
      <p class="station-address">${station.address}</p>
      <div class="connector-tags">
        ${connectorsHTML}
      </div>
      <div class="station-card-footer">
        <span class="station-distance">Network: <strong>${station.network}</strong></span>
        <a href="#report" class="report-link" onclick="document.getElementById('station-name').value = '${station.name.replace(/'/g, "\\'")}'">
          Report issue →
        </a>
      </div>
    `;
        domElements.stationsList.appendChild(card);
    });
}

async function fetchReports() {
    try {
        const response = await fetch(`${API_BASE_URL}/reports`);
        const result = await response.json();
        const reportsData = result.data || result || [];
        renderReports(reportsData);
    } catch (error) {
        console.error('Error fetching reports:', error);
        domElements.reportsFeed.innerHTML = '<li>Error loading reports feed.</li>';
    }
}

function renderReports(reports) {
    const backendUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
    domElements.reportsFeed.innerHTML = '';

    if (reports.length === 0) {
        domElements.reportsFeed.innerHTML = '<li class="feed-empty">No recent reports yet.</li>';
        return;
    }

    reports.forEach(report => {
        if (report.status !== 'resolved') {
            const li = document.createElement('li');
            li.className = 'feed-item';
            const date = new Date(report.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            let photoHTML = ''
            if (report.photo && report.photo !== 'No photo') {
                const photoPath = report.photo.startsWith('/') ? report.photo : `/${report.photo}`;
                photoHTML = `
                    <div style="margin-top: 14px;margin-bottom: 14px">
                        <button type="button" 
                                style="background-color: #facc15; color: #111827; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: opacity 0.2s ease;"
                                onmouseover="this.style.opacity='0.85'"
                                onmouseout="this.style.opacity='1'"
                                onclick="const img = this.nextElementSibling; img.style.display = img.style.display === 'none' ? 'block' : 'none'; this.innerText = img.style.display === 'none' ? 'Open Photo' : 'Close Photo';">
                            Open Photo
                        </button>
                        <div class="feed-photo" style="display: none; margin-top: 12px;">
                            <img src="${backendUrl}${photoPath}" alt="Issue photo" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border-color, #333);" />
                        </div>
                    </div>`;
            }
            li.innerHTML = `
            <span class="feed-issue-type">${report.issueType}</span>
            <div class="feed-body">
                <h4>${report.stationName}</h4>
                <p>${report.description}</p>
                ${photoHTML}
            </div>
            <div class="feed-footer">
                <span class="feed-reporter">Reported by ${report.reporterName || 'Anonymous'}</span>
                <span class="feed-time">${date}</span>
            </div>
        `;
            domElements.reportsFeed.appendChild(li)
        }
    });
}

async function handleReportSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    const photoInput = document.getElementById('photo');
    const formData = new FormData()
    formData.append('stationName', document.getElementById('station-name').value)
    formData.append('issueType', document.getElementById('issue-type').value)
    formData.append('description', document.getElementById('issue-desc').value)
    formData.append('reporterName', document.getElementById('reporter-name').value || 'Anonymous')
    if (photoInput.files && photoInput.files.length > 0) {
        formData.append('photo', photoInput.files[0]);
    }
    try {
        const response = await fetch(`${API_BASE_URL}/reports`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok) {
            alert('Report submitted successfully! The station has been marked as faulty.');
            e.target.reset();
            fetchReports();

            // FIX: Dynamically insert into Admin Queue without refresh
            const adminQueue = document.getElementById('admin-queue-container');
            if (adminQueue) {
                const newReport = result.data || result;
                const newId = newReport._id;

                if (newId) {
                    const newItemHTML = `<div class="queue-item" data-report-id="${newId}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div>
                                <strong style="color: var(--text-primary); font-size: 0.95rem;">${formData.stationName}</strong>
                                <p style="font-size: 0.8rem; color: var(--accent-fault); margin-top: 2px;">Issue: ${formData.issueType}</p>
                            </div>
                            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #64748b;">just now</span>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">"${formData.description}"</p>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="btn-action-sm btn-action-live" onclick="resolveReport('${newId}', 'available')">Mark Fixed</button>
                            <button type="button" class="btn-action-sm btn-action-fault" onclick="resolveReport('${newId}', 'fault')">Flag Station Fault</button>
                            <button type="button" class="btn-action-sm btn-action-dim" onclick="dismissReport('${newId}')">Dismiss</button>
                        </div>
                    </div>`;

                    adminQueue.insertAdjacentHTML('afterbegin', newItemHTML);

                    const counterElement = document.getElementById('numberOfReports');
                    if (counterElement) {
                        const currentCount = parseInt(counterElement.innerText) || 0;
                        counterElement.innerText = `${currentCount + 1} Open`;
                    }
                }
            }
        } else {
            alert(`Error: ${result.message || 'Failed to submit report'}`);
        }
    } catch (error) {
        console.error('Error submitting report:', error);
        alert('An error occurred while submitting your report.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Report';
    }
}

/**
 * 4. Fetch & Update Dashboard Stats
 */
async function fetchStats() {
    // Fetch Tracked
    fetch(`${API_BASE_URL}/stats/tracked`)
        .then(res => res.json())
        .then(data => {
            if (domElements.stats.tracked) domElements.stats.tracked.textContent = data.data || 0;
        })
        .catch(err => console.error('Error fetching tracked stats', err));

    // Fetch Reported Today
    fetch(`${API_BASE_URL}/stats/reported-today`)
        .then(res => res.json())
        .then(data => {
            if (domElements.stats.reportedToday) {
                const count =  data.data || 0;
                domElements.stats.reportedToday.textContent = count;
            }
        })
        .catch(err => console.error('Error fetching reported stats', err));

    // Fetch Fixed This Week
    fetch(`${API_BASE_URL}/stats/fixed-this-week`)
        .then(res => res.json())
        .then(data => {
            if (domElements.stats.fixedThisWeek) {
                const count = data.data || 0;
                domElements.stats.fixedThisWeek.textContent = count;
            }
        })
        .catch(err => console.error('Error fetching fixed stats', err));
}

// --- Search Stations (Wrapped in Null Check) ---
const heroSearchForm = document.getElementById('hero-search');
if (heroSearchForm) {
    const locationInput = document.getElementById('location-input');
    heroSearchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = locationInput.value.trim();
        if (!query) return;

        const chargerSubmitBtn = document.getElementById('chargerBtn');
        const originalText = chargerSubmitBtn.textContent;
        chargerSubmitBtn.textContent = 'searching.......';
        chargerSubmitBtn.disabled = true;

        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.length > 0) {
                const latitude = parseFloat(data[0].lat);
                const longitude = parseFloat(data[0].lon);
                await fetchStations(latitude, longitude);
                document.getElementById('stations').scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error(`We couldn't find that location. Try adding something different.`);
            }
        } catch (err) {
            console.error("Geocoding Error:", err);
            alert("Something went wrong while searching. Please try again.");
        } finally {
            chargerSubmitBtn.textContent = originalText;
            chargerSubmitBtn.disabled = false;
        }
    });
}

// --- Authentication Page Logic (auth.html) ---
function initAuth() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');
    const loginStatus = document.getElementById('login-status');
    const regStatus = document.getElementById('reg-status');
    const authHeading = document.getElementById('auth-heading');

    if (!tabLogin || !tabRegister) return;

    function clearStatuses() {
        if (loginStatus) { loginStatus.textContent = ''; loginStatus.className = 'form-status'; }
        if (regStatus) { regStatus.textContent = ''; regStatus.className = 'form-status'; }
    }

    function showStatus(element, text, isError) {
        if (!element) return;
        element.textContent = text;
        element.className = isError ? 'form-status is-error' : 'form-status';
    }

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('is-active');
        tabLogin.setAttribute('aria-selected', 'true');
        tabRegister.classList.remove('is-active');
        tabRegister.setAttribute('aria-selected', 'false');

        formLogin.classList.add('is-active');
        formRegister.classList.remove('is-active');
        if (authHeading) authHeading.textContent = 'Sign in to your account';
        clearStatuses();
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('is-active');
        tabRegister.setAttribute('aria-selected', 'true');
        tabLogin.classList.remove('is-active');
        tabLogin.setAttribute('aria-selected', 'false');

        formRegister.classList.add('is-active');
        formLogin.classList.remove('is-active');
        if (authHeading) authHeading.textContent = 'Create your Voltfix account';
        clearStatuses();
    });

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('login-btn');
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                showStatus(loginStatus, 'Please enter email and password.', true);
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            try {
                const res = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    showStatus(loginStatus, 'Login successful! Redirecting...', false);
                    localStorage.setItem('voltfix_token', data.token);
                    localStorage.setItem('voltfix_user', JSON.stringify(data.data));
                    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
                } else {
                    showStatus(loginStatus, data.message || 'Invalid credentials.', true);
                }
            } catch (err) {
                console.error('Login error:', err);
                showStatus(loginStatus, 'Unable to connect to server.', true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });
    }

    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('reg-btn');
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const adminSecret = document.getElementById('reg-admin-secret').value.trim();

            if (!name || !email || !password) {
                showStatus(regStatus, 'Please fill in all fields.', true);
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';

            try {
                const res = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, adminSecret })
                });
                const data = await res.json();

                if (res.ok) {
                    showStatus(regStatus, 'Account created! Signing you in...', false);
                    localStorage.setItem('voltfix_token', data.token);
                    localStorage.setItem('voltfix_user', JSON.stringify(data.data));
                    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
                } else {
                    showStatus(regStatus, data.message || 'Registration failed.', true);
                }
            } catch (err) {
                console.error('Registration error:', err);
                showStatus(regStatus, 'Unable to connect to server.', true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
    }
}

function formatTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const secondsAgo = Math.floor((now - past) / 1000);

    if (secondsAgo < 5) return 'just now';

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(secondsAgo / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
}