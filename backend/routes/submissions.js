/* =====================================================
   Submissions Route — POST /api/submissions
   Handles student transportation survey submissions
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { appendOfflineSubmission } = require('../utils/fallbackStore');

// Validation rules matching the API contract
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const VALID_MODES = ['Bus', 'Bike', 'Car', 'Metro', 'Auto', 'Walking'];
const VALID_WEATHER = ['Sunny', 'Rainy', 'Any'];
const VALID_TRAVEL_TYPES = ['Solo', 'Group'];

/**
 * Validate submission data
 * @param {object} body - Request body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSubmission(body) {
    const errors = [];

    // Name
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
        errors.push('name is required and must be at least 2 characters');
    }

    // Age
    const age = Number(body.age);
    if (!body.age || isNaN(age) || age < 10 || age > 60) {
        errors.push('age must be a number between 10 and 60');
    }

    // Gender
    if (!VALID_GENDERS.includes(body.gender)) {
        errors.push(`gender must be one of: ${VALID_GENDERS.join(', ')}`);
    }

    // Distance
    const distance = Number(body.distance_km);
    if (!body.distance_km || isNaN(distance) || distance < 0.1 || distance > 100) {
        errors.push('distance_km must be a number between 0.1 and 100');
    }

    // Transport Mode
    if (!VALID_MODES.includes(body.transport_mode)) {
        errors.push(`transport_mode must be one of: ${VALID_MODES.join(', ')}`);
    }

    // Travel Time
    const time = Number(body.travel_time_min);
    if (!body.travel_time_min || isNaN(time) || time < 1 || time > 300) {
        errors.push('travel_time_min must be a number between 1 and 300');
    }

    // Monthly Cost
    const cost = Number(body.monthly_cost);
    if (body.monthly_cost === undefined || body.monthly_cost === null || isNaN(cost) || cost < 0 || cost > 50000) {
        errors.push('monthly_cost must be a number between 0 and 50000');
    }

    // Weather Preference
    if (!VALID_WEATHER.includes(body.weather_preference)) {
        errors.push(`weather_preference must be one of: ${VALID_WEATHER.join(', ')}`);
    }

    // Travel Type
    if (!VALID_TRAVEL_TYPES.includes(body.travel_type)) {
        errors.push(`travel_type must be one of: ${VALID_TRAVEL_TYPES.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * POST /api/submissions
 * Submit a new student transportation survey response
 */
router.post('/', async (req, res) => {
    try {
        // Validate input
        const { valid, errors } = validateSubmission(req.body);

        if (!valid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors,
            });
        }

        // Check if Supabase is configured
        if (!supabase) {
            return res.status(503).json({
                success: false,
                message: 'Database not configured. Please set the required database settings in your .env file.',
            });
        }

        // Prepare clean data
        const cleanData = {
            name: req.body.name.trim(),
            age: parseInt(req.body.age, 10),
            gender: req.body.gender,
            distance_km: parseFloat(req.body.distance_km),
            transport_mode: req.body.transport_mode,
            travel_time_min: parseInt(req.body.travel_time_min, 10),
            monthly_cost: parseFloat(req.body.monthly_cost),
            weather_preference: req.body.weather_preference,
            travel_type: req.body.travel_type,
        };

        // Insert into Supabase
        const result = await supabase
            .from('student_responses')
            .insert(cleanData);

        if (result.error) {
            console.error('Supabase insert error:', result.error);
            const offlineRecord = await appendOfflineSubmission(cleanData);
            return res.status(201).json({
                success: true,
                message: 'Submission saved locally (database sync pending)',
                data: {
                    id: offlineRecord.id,
                    name: cleanData.name,
                    created_at: offlineRecord.created_at,
                    source: 'offline-fallback',
                },
            });
        }

        const inserted = Array.isArray(result.data) ? result.data[0] : result.data;

        return res.status(201).json({
            success: true,
            message: 'Submission recorded successfully',
            data: {
                id: inserted?.id || 'saved',
                name: cleanData.name,
                created_at: inserted?.created_at || new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Submission route error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});

module.exports = router;
