/* =====================================================
   Analytics Route — GET /api/analytics
   Returns aggregated analytics data for the dashboard
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { getOfflineCount } = require('../utils/fallbackStore');

/**
 * GET /api/analytics
 * Returns aggregated transportation analytics.
 */
router.get('/', async (req, res) => {
    try {
        // If Supabase is not configured, return stub data
        if (!supabase) {
            const offlineCount = await getOfflineCount();
            return res.json({
                success: true,
                data: {
                    total_responses: offlineCount,
                    mode_frequency: {},
                    mode_distribution_percent: {},
                    statistics: {},
                    scatter_data: [],
                    _note: 'Database not configured. Showing local fallback data.',
                },
            });
        }

        // Fetch data from the view we created
        const { data: summaryData, error: summaryError } = await supabase
            .from('analytics_summary')
            .select('*');

        if (summaryError) {
            console.error('Analytics summary error:', summaryError);
            throw new Error('Failed to fetch analytics summary');
        }

        // Fetch raw data for scatter plot
        const { data: rawData, error: rawError } = await supabase
            .from('student_responses')
            .select('distance_km,travel_time_min,transport_mode');

        if (rawError) {
            console.error('Analytics raw data error:', rawError);
            throw new Error('Failed to fetch raw scatter data');
        }

        let total_responses = 0;
        const mode_frequency = {};
        const mode_distribution_percent = {};
        const statistics = {};

        if (summaryData) {
            summaryData.forEach(row => {
                total_responses += parseInt(row.response_count, 10);
                mode_frequency[row.transport_mode] = parseInt(row.response_count, 10);
                mode_distribution_percent[row.transport_mode] = parseFloat(row.pct_of_total);
                
                statistics[row.transport_mode] = {
                    avg_distance_km: parseFloat(row.avg_distance_km),
                    avg_travel_time_min: parseFloat(row.avg_travel_time_min),
                    avg_monthly_cost: parseFloat(row.avg_monthly_cost)
                };
            });
        }

        const scatter_data = rawData ? rawData.map(r => ({
            x: parseFloat(r.distance_km),
            y: parseInt(r.travel_time_min, 10),
            mode: r.transport_mode
        })) : [];

        return res.json({
            success: true,
            data: {
                total_responses,
                mode_frequency,
                mode_distribution_percent,
                statistics,
                scatter_data,
            },
        });
    } catch (error) {
        console.error('Analytics route error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});

module.exports = router;
