/* =====================================================
   Analytics Route — GET /api/analytics
   Returns aggregated analytics data for the dashboard
   (Full logic will be implemented in Phase 3)
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { getOfflineCount } = require('../utils/fallbackStore');

/**
 * GET /api/analytics
 * Returns aggregated transportation analytics.
 *
 * Phase 1: Returns total_responses count (if DB available) or stub data.
 * Phase 3: Will compute full statistics, distributions, and scatter data.
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

        // Phase 1: Just get total response count
        const { count, error } = await supabase
            .from('student_responses')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Analytics count error:', error);
            const offlineCount = await getOfflineCount();
            return res.json({
                success: true,
                data: {
                    total_responses: offlineCount,
                    mode_frequency: {},
                    mode_distribution_percent: {},
                    statistics: {},
                    scatter_data: [],
                    _note: 'Live database temporarily unavailable. Showing local fallback count.',
                },
            });
        }

        return res.json({
            success: true,
            data: {
                total_responses: count || 0,
                mode_frequency: {},
                mode_distribution_percent: {},
                statistics: {},
                scatter_data: [],
                _note: 'Full analytics coming in Phase 3. Currently only total_responses is live.',
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
