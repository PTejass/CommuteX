/* =====================================================
   CommuteX — Frontend Application Logic
   Smart Student Transportation System
   ===================================================== */

// ========== API Configuration ==========
const API_CONFIG = {
    BASE_URL: resolveApiBaseUrl(),
    FALLBACK_BASE_URLS: [
        'http://localhost:3000/api',
        'http://127.0.0.1:3000/api',
    ],
    ENDPOINTS: {
        SUBMISSIONS: '/submissions',
        RECOMMENDATIONS: '/recommendations',
        ANALYTICS: '/analytics',
    },
};

function resolveApiBaseUrl() {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isLiveServerPort = ['5500', '5501', '8080', '8081'].includes(window.location.port);

    if (isLocalhost && isLiveServerPort) {
        return 'http://localhost:3000/api';
    }

    return `${window.location.origin}/api`;
}

function getCandidateBaseUrls() {
    return [API_CONFIG.BASE_URL, ...API_CONFIG.FALLBACK_BASE_URLS]
        .filter(Boolean)
        .filter((url, index, arr) => arr.indexOf(url) === index);
}

async function fetchFromApi(endpoint, options = {}) {
    const candidates = getCandidateBaseUrls();
    let lastError = null;

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, options);
            API_CONFIG.BASE_URL = baseUrl;
            return response;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Network request failed');
}


// ========== Toast Notification System ==========
const toastContainer = document.getElementById('toast-container');

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'} type - Type of toast
 * @param {number} duration - Duration in ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ========== Mobile Navigation Toggle ==========
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
});

// Close mobile nav when a link is clicked
navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
    });
});

// ========== Active Nav Link on Scroll ==========
const sections = document.querySelectorAll('.hero, .section');
const navLinkEls = document.querySelectorAll('.nav-link');

function updateActiveNav() {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            current = section.id;
        }
    });

    navLinkEls.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === current) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', updateActiveNav);

// ========== Form Validation ==========
const form = document.getElementById('survey-form');
const btnSubmit = document.getElementById('btn-submit');

const VALIDATION_RULES = {
    name: {
        required: true,
        minLength: 2,
        maxLength: 100,
        errorEl: 'error-name',
        message: 'Please enter a valid name (2-100 characters)',
    },
    age: {
        required: true,
        min: 10,
        max: 60,
        type: 'number',
        errorEl: 'error-age',
        message: 'Age must be between 10 and 60',
    },
    gender: {
        required: true,
        errorEl: 'error-gender',
        message: 'Please select a gender',
    },
    distance_km: {
        required: true,
        min: 0.1,
        max: 100,
        type: 'number',
        errorEl: 'error-distance',
        message: 'Distance must be between 0.1 and 100 km',
    },
    transport_mode: {
        required: true,
        errorEl: 'error-mode',
        message: 'Please select a transport mode',
    },
    travel_time_min: {
        required: true,
        min: 1,
        max: 300,
        type: 'number',
        errorEl: 'error-time',
        message: 'Travel time must be between 1 and 300 minutes',
    },
    monthly_cost: {
        required: true,
        min: 0,
        max: 50000,
        type: 'number',
        errorEl: 'error-cost',
        message: 'Monthly cost must be between ₹0 and ₹50,000',
    },
    weather_preference: {
        required: true,
        errorEl: 'error-weather',
        message: 'Please select a weather preference',
    },
    travel_type: {
        required: true,
        errorEl: 'error-travel-type',
        message: 'Please select Solo or Group',
    },
};

/**
 * Validate a single field
 * @returns {boolean} true if valid
 */
function validateField(name, value) {
    const rule = VALIDATION_RULES[name];
    if (!rule) return true;

    const errorEl = document.getElementById(rule.errorEl);
    let isValid = true;

    // Required check
    if (rule.required && (!value || value.toString().trim() === '')) {
        isValid = false;
    }

    // Number range check
    if (isValid && rule.type === 'number' && value) {
        const num = parseFloat(value);
        if (isNaN(num) || num < rule.min || num > rule.max) {
            isValid = false;
        }
    }

    // String length check
    if (isValid && rule.minLength && value) {
        if (value.toString().trim().length < rule.minLength) {
            isValid = false;
        }
    }

    // Update UI
    if (errorEl) {
        errorEl.textContent = isValid ? '' : rule.message;
    }

    // Update input styling
    const inputEl = form.querySelector(`[name="${name}"]`);
    if (inputEl && inputEl.classList) {
        inputEl.classList.toggle('error', !isValid);
        inputEl.classList.toggle('success', isValid && value);
    }

    return isValid;
}

/**
 * Validate the entire form
 * @returns {{ valid: boolean, data: object }}
 */
function validateForm() {
    const formData = new FormData(form);
    const data = {};
    let allValid = true;

    // Collect form values
    for (const [key, val] of formData.entries()) {
        data[key] = val;
    }

    // Validate each field
    for (const fieldName of Object.keys(VALIDATION_RULES)) {
        const value = data[fieldName] || '';
        const valid = validateField(fieldName, value);
        if (!valid) allValid = false;
    }

    // Convert numeric fields
    if (allValid) {
        data.age = parseInt(data.age, 10);
        data.distance_km = parseFloat(data.distance_km);
        data.travel_time_min = parseInt(data.travel_time_min, 10);
        data.monthly_cost = parseFloat(data.monthly_cost);
    }

    return { valid: allValid, data };
}

// Real-time validation on blur
form.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('blur', () => {
        validateField(input.name, input.value);
    });
});

// ========== Form Submission ==========
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { valid, data } = validateForm();

    if (!valid) {
        showToast('Please fix the errors in the form.', 'error');
        return;
    }

    // Show loading state
    btnSubmit.disabled = true;
    const originalContent = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<div class="spinner"></div><span>Submitting...</span>';

    try {
        const response = await fetchFromApi(API_CONFIG.ENDPOINTS.SUBMISSIONS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('🎉 Response submitted successfully!', 'success');
            form.reset();
            clearValidationStyles();

            // Refresh dashboard + show recommendations based on submission
            loadDashboard();
            fetchRecommendations(data.distance_km, data.weather_preference, data.travel_type);
        } else {
            const errorMsg = result.errors
                ? result.errors.join(', ')
                : result.message || 'Submission failed';
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Submission error:', error);
        showToast('Could not connect to the server. Is the backend running?', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
    }
});

/**
 * Clear all validation styles and error messages
 */
function clearValidationStyles() {
    form.querySelectorAll('.form-input').forEach(input => {
        input.classList.remove('error', 'success');
    });
    form.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
    });
}

// Clear form also clears validation
document.getElementById('btn-reset').addEventListener('click', () => {
    clearValidationStyles();
});


// ========== Chart.js Configuration ==========
// Shared color palette for transport modes — Colorful theme
const MODE_COLORS = {
    Bus: { bg: 'rgba(59, 130, 246, 0.7)', border: '#3b82f6' },
    Bike: { bg: 'rgba(245, 158, 11, 0.7)', border: '#f59e0b' },
    Car: { bg: 'rgba(239, 68, 68, 0.7)', border: '#ef4444' },
    Metro: { bg: 'rgba(168, 85, 247, 0.7)', border: '#a855f7' },
    Auto: { bg: 'rgba(236, 72, 153, 0.7)', border: '#ec4899' },
    Walking: { bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981' },
};

const ALL_MODES = ['Bus', 'Bike', 'Car', 'Metro', 'Auto', 'Walking'];

// Chart.js global defaults for dark theme
function applyChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#8db8c7';
    Chart.defaults.borderColor = 'rgba(212, 175, 55, 0.08)';
    Chart.defaults.font.family = "'Inter', sans-serif";
}

// Hold chart instances so we can update/destroy them
let barChart = null;
let pieChart = null;
let scatterChart = null;

/**
 * Create or update the Bar Chart (Mode Frequency)
 */
function renderBarChart(modeFrequency) {
    const ctx = document.getElementById('chart-bar');
    if (!ctx) return;

    const labels = ALL_MODES;
    const data = labels.map(m => modeFrequency[m] || 0);
    const bgColors = labels.map(m => MODE_COLORS[m]?.bg || 'rgba(148, 163, 184, 0.5)');
    const borderColors = labels.map(m => MODE_COLORS[m]?.border || '#94a3b8');

    if (barChart) barChart.destroy();

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Number of Students',
                data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: 'rgba(148, 163, 184, 0.08)' },
                },
                x: {
                    grid: { display: false },
                },
            },
        },
    });
}

/**
 * Create or update the Pie Chart (Mode Distribution %)
 */
function renderPieChart(modeDistribution) {
    const ctx = document.getElementById('chart-pie');
    if (!ctx) return;

    const labels = ALL_MODES.filter(m => (modeDistribution[m] || 0) > 0);
    const data = labels.map(m => modeDistribution[m]);
    const bgColors = labels.map(m => MODE_COLORS[m]?.bg || 'rgba(148, 163, 184, 0.5)');
    const borderColors = labels.map(m => MODE_COLORS[m]?.border || '#94a3b8');

    // If no data yet, show all modes at 0
    if (labels.length === 0) {
        labels.push(...ALL_MODES);
        data.push(...ALL_MODES.map(() => 0));
        bgColors.push(...ALL_MODES.map(m => MODE_COLORS[m]?.bg));
        borderColors.push(...ALL_MODES.map(m => MODE_COLORS[m]?.border));
    }

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: bgColors,
                borderColor: 'rgba(10, 14, 26, 0.8)',
                borderWidth: 3,
                hoverOffset: 12,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                        font: { size: 12 },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
                    },
                },
            },
        },
    });
}

/**
 * Create or update the Scatter Chart (Distance vs Travel Time)
 */
function renderScatterChart(scatterData) {
    const ctx = document.getElementById('chart-scatter');
    if (!ctx) return;

    // Group scatter points by mode
    const datasets = ALL_MODES.map(mode => {
        const points = scatterData.filter(p => p.mode === mode);
        return {
            label: mode,
            data: points.map(p => ({ x: p.x, y: p.y })),
            backgroundColor: MODE_COLORS[mode]?.bg || 'rgba(148, 163, 184, 0.5)',
            borderColor: MODE_COLORS[mode]?.border || '#94a3b8',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 9,
        };
    }).filter(ds => ds.data.length > 0);

    if (scatterChart) scatterChart.destroy();

    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                        font: { size: 12 },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x} km, ${ctx.parsed.y} min`,
                    },
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Distance (km)',
                        color: '#94a3b8',
                        font: { weight: '600' },
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.08)' },
                },
                y: {
                    title: {
                        display: true,
                        text: 'Travel Time (min)',
                        color: '#94a3b8',
                        font: { weight: '600' },
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.08)' },
                },
            },
        },
    });
}


// ========== Dashboard Data Loader ==========
async function loadDashboard() {
    try {
        const response = await fetchFromApi(API_CONFIG.ENDPOINTS.ANALYTICS);
        const result = await response.json();

        if (!result.success || !result.data) {
            console.warn('Analytics API returned no data');
            return;
        }

        const d = result.data;

        // Update hero response count
        const countEl = document.getElementById('stat-responses');
        if (countEl) {
            animateCounter(countEl, parseInt(countEl.textContent) || 0, d.total_responses);
        }

        // Render charts (Chart.js must be loaded)
        if (typeof Chart !== 'undefined') {
            applyChartDefaults();
            renderBarChart(d.mode_frequency || {});
            renderPieChart(d.mode_distribution_percent || {});
            renderScatterChart(d.scatter_data || []);
        } else {
            console.warn('Chart.js not loaded yet — retrying in 1s');
            setTimeout(loadDashboard, 1000);
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}


// ========== Recommendations Display ==========
const MODE_ICONS = {
    Bus: '🚌', Bike: '🏍️', Car: '🚗',
    Metro: '🚇', Auto: '🛺', Walking: '🚶',
};

async function fetchRecommendations(distance_km, weather, travel_type) {
    const container = document.getElementById('reco-placeholder');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div class="reco-loading">
            <div class="spinner"></div>
            <p>Calculating smart recommendations...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams({
            distance_km: distance_km.toString(),
            weather: weather || 'Any',
            travel_type: travel_type || 'Solo',
        });

        const response = await fetchFromApi(`${API_CONFIG.ENDPOINTS.RECOMMENDATIONS}?${params}`);
        const result = await response.json();

        if (!result.success || !result.data || !result.data.recommendations) {
            container.innerHTML = `
                <div class="reco-placeholder-icon">⚠️</div>
                <p>Could not load recommendations. Try again later.</p>
            `;
            return;
        }

        const recs = result.data.recommendations;
        const usedParams = result.data.parameters_used;

        let html = `
            <div class="reco-params">
                <span class="reco-param-tag">📏 ${usedParams.distance_km} km</span>
                <span class="reco-param-tag">${usedParams.weather === 'Rainy' ? '🌧️' : '☀️'} ${usedParams.weather}</span>
                <span class="reco-param-tag">${usedParams.travel_type === 'Group' ? '👥' : '🧍'} ${usedParams.travel_type}</span>
            </div>
            <div class="reco-grid">
        `;

        recs.forEach((rec, index) => {
            const icon = MODE_ICONS[rec.mode] || '🚐';
            const rankClass = index === 0 ? 'reco-card--top' : '';
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

            html += `
                <div class="reco-card ${rankClass}">
                    <div class="reco-card-rank">${medal || `#${index + 1}`}</div>
                    <div class="reco-card-icon">${icon}</div>
                    <h4 class="reco-card-mode">${rec.mode}</h4>
                    <div class="reco-card-score">
                        <div class="score-ring" style="--score: ${rec.score}">
                            <span>${rec.score}</span>
                        </div>
                        <span class="score-label">Score</span>
                    </div>
                    <div class="reco-card-stats">
                        <div class="reco-stat">
                            <span class="reco-stat-value">₹${rec.estimated_cost.toFixed(0)}</span>
                            <span class="reco-stat-label">Est. Cost</span>
                        </div>
                        <div class="reco-stat">
                            <span class="reco-stat-value">${rec.estimated_time_min.toFixed(0)} min</span>
                            <span class="reco-stat-label">Est. Time</span>
                        </div>
                    </div>
                    <p class="reco-card-reason">${rec.reason}</p>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error('Recommendations error:', err);
        container.innerHTML = `
            <div class="reco-placeholder-icon">❌</div>
            <p>Could not connect to the server for recommendations.</p>
        `;
    }
}


// ========== Dynamic Response Count ==========
/**
 * Animate a counter from start to end
 */
function animateCounter(el, start, end) {
    const duration = 800;
    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out quad
        const eased = 1 - (1 - progress) * (1 - progress);
        el.textContent = Math.round(start + (end - start) * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}


// ========== Intersection Observer for Scroll Animations ==========
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };

const animateOnScroll = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Apply to all section headers and cards
document.querySelectorAll('.section-header, .chart-card, .survey-form, .reco-placeholder').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    animateOnScroll.observe(el);
});


// ========== Initialize on Page Load ==========
// Load dashboard data and charts
loadDashboard();

console.log('🚌 CommuteX Frontend loaded successfully');
console.log(`📡 API endpoint: ${API_CONFIG.BASE_URL}`);
