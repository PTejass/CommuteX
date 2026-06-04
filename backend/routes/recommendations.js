/* =====================================================
   Recommendations Route — GET /api/recommendations
   Returns smart transport mode recommendations
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
    try {
        const { distance_km, weather = 'Any', travel_type = 'Solo', nearest_bus_km, nearest_metro_km } = req.query;

        // Basic validation
        if (!distance_km || isNaN(Number(distance_km))) {
            return res.status(400).json({
                success: false,
                message: 'distance_km query parameter is required and must be a number',
            });
        }

        if (!supabase) {
            return res.status(503).json({ success: false, message: 'Database not connected' });
        }

        const distance = parseFloat(distance_km);

        // Fetch pricing coefficients
        const { data: pricingData, error } = await supabase
            .from('dummy_pricing')
            .select('*');

        if (error || !pricingData) {
            console.error('Pricing data error:', error);
            throw new Error('Failed to fetch pricing data');
        }

        const recommendations = pricingData.map(modeData => {
            // 1. Calculate base time and cost
            let estimated_time_min = (distance / parseFloat(modeData.avg_speed_kmh)) * 60;
            let estimated_cost = distance * parseFloat(modeData.base_cost_per_km);

            // 2. Apply weather penalty (if it's raining, time and cost might increase)
            if (weather === 'Rainy') {
                estimated_time_min *= parseFloat(modeData.weather_penalty_rainy);
                estimated_cost *= parseFloat(modeData.weather_penalty_rainy);
            }

            // 3. Apply group discount (if traveling in a group, cost might decrease)
            if (travel_type === 'Group') {
                estimated_cost *= parseFloat(modeData.group_discount);
            }

            // Round to 2 decimals
            estimated_time_min = Math.round(estimated_time_min * 100) / 100;
            estimated_cost = Math.round(estimated_cost * 100) / 100;

            // 4. Calculate a simplified smart score (0-100 scale)
            // Normalizing time (assuming max reasonable commute 120 mins)
            let timeScore = Math.max(0, 100 - (estimated_time_min / 120 * 100));
            // Normalizing cost (assuming max reasonable daily cost 500)
            let costScore = Math.max(0, 100 - (estimated_cost / 500 * 100));
            // Walking is free, so costScore should be maxed out
            if (estimated_cost === 0) costScore = 100;
            
            // Weight the scores (Time: 30%, Cost: 30%, Comfort: 20%, Eco: 20%)
            const comfortScore = (parseInt(modeData.comfort_score, 10) * 10);
            const ecoScore = (parseInt(modeData.eco_score, 10) * 10);
            
            const finalScore = 
                (timeScore * 0.3) + 
                (costScore * 0.3) + 
                (comfortScore * 0.2) + 
                (ecoScore * 0.2);

            // 5. Apply transit proximity bonus (if location data provided)
            let proximityBonus = 0;
            let proximityReason = null;
            const busDist = nearest_bus_km != null ? parseFloat(nearest_bus_km) : null;
            const metroDist = nearest_metro_km != null ? parseFloat(nearest_metro_km) : null;

            if (modeData.transport_mode === 'Bus' && busDist != null && !isNaN(busDist) && busDist <= 1.0) {
                proximityBonus = busDist <= 0.5 ? 20 : 15;
                proximityReason = `A bus stop is just ${busDist} km from your location!`;
            } else if (modeData.transport_mode === 'Metro' && metroDist != null && !isNaN(metroDist) && metroDist <= 1.0) {
                proximityBonus = metroDist <= 0.5 ? 20 : 15;
                proximityReason = `A metro station is just ${metroDist} km from your location!`;
            }

            const boostedScore = Math.min(100, finalScore + proximityBonus);

            // Simple reasoning logic
            let reason = proximityReason || 'Good balance of cost and time.';
            if (!proximityReason) {
                if (weather === 'Rainy' && modeData.weather_penalty_rainy > 1.2) {
                    reason = 'Not ideal for rainy weather.';
                } else if (travel_type === 'Group' && modeData.group_discount < 1.0) {
                    reason = 'Great for group travel due to cost discount.';
                } else if (estimated_cost === 0) {
                    reason = 'Most cost-effective and eco-friendly option.';
                } else if (timeScore > 80) {
                    reason = 'Fastest way to reach your destination.';
                } else if (comfortScore >= 80) {
                    reason = 'Prioritizes maximum comfort for the journey.';
                }
            }

            return {
                mode: modeData.transport_mode,
                score: Math.round(boostedScore),
                estimated_cost,
                estimated_time_min,
                reason,
                proximity_boost: proximityBonus > 0 ? proximityBonus : undefined,
            };
        });

        // Sort by highest score first
        recommendations.sort((a, b) => b.score - a.score);

        return res.json({
            success: true,
            data: {
                recommendations,
                parameters_used: {
                    distance_km: distance,
                    weather,
                    travel_type,
                }
            },
        });
    } catch (error) {
        console.error('Recommendations route error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});

module.exports = router;
