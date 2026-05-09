/* =====================================================
   Recommendations Route — GET /api/recommendations
   Returns smart transport mode recommendations
   (Full logic will be implemented in Phase 3)
   ===================================================== */

const express = require('express');
const router = express.Router();

/**
 * GET /api/recommendations
 * Query params: distance_km (required), weather (optional), travel_type (optional)
 *
 * Phase 1: Returns a stub response with the expected structure.
 * Phase 3: Will implement the actual scoring algorithm.
 */
router.get('/', (req, res) => {
    const { distance_km, weather = 'Any', travel_type = 'Solo' } = req.query;

    // Basic validation
    if (!distance_km || isNaN(Number(distance_km))) {
        return res.status(400).json({
            success: false,
            message: 'distance_km query parameter is required and must be a number',
        });
    }

    // Phase 1 stub: Return placeholder recommendations
    // This will be replaced with real scoring logic in Phase 3
    return res.json({
        success: true,
        data: {
            recommendations: [
                {
                    mode: 'Bus',
                    score: 0,
                    estimated_cost: 0,
                    estimated_time_min: 0,
                    reason: 'Recommendation engine not yet implemented (Phase 3)',
                },
            ],
            parameters_used: {
                distance_km: parseFloat(distance_km),
                weather,
                travel_type,
            },
            _note: 'This is a stub response. Full recommendation logic coming in Phase 3.',
        },
    });
});

module.exports = router;
