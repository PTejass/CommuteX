/* =====================================================
   TransitIQ — Frontend Application Logic
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
            updateResponseCount();
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

// ========== Dynamic Response Count ==========
async function updateResponseCount() {
    try {
        const response = await fetchFromApi(API_CONFIG.ENDPOINTS.ANALYTICS);
        const result = await response.json();
        if (result.success && result.data) {
            const countEl = document.getElementById('stat-responses');
            if (countEl) {
                animateCounter(countEl, parseInt(countEl.textContent) || 0, result.data.total_responses);
            }
        }
    } catch {
        // Silently fail — backend may not be running yet
    }
}

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

// Try fetching count on page load
updateResponseCount();

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

console.log('🚌 TransitIQ Frontend loaded successfully');
console.log(`📡 Connected to Supabase directly`);
