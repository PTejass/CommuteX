/* =====================================================
   Nearby Transit Route — GET /api/nearby-transit
   Finds nearest bus stops and metro stations using
   OpenStreetMap Overpass API (free, no key required).
   ===================================================== */

const express = require('express');
const router = express.Router();
const dns = require('dns');

// Prefer IPv4 to avoid intermittent DNS/IPv6 connectivity failures
// (same fix applied in config/supabase.js)
dns.setDefaultResultOrder('ipv4first');

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_METERS = 2000; // 2 km search radius

/**
 * Haversine formula — calculates the great-circle distance
 * between two points on a sphere given their lat/lng.
 * @returns {number} distance in kilometres
 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Query the Overpass API for nearby transit stops.
 * Searches for bus stops and metro/subway stations within
 * SEARCH_RADIUS_METERS of the given coordinates.
 * Tries primary URL first, then falls back to a mirror.
 */
async function queryOverpass(lat, lng) {
    // Overpass QL query — search for bus stops AND metro stations
    const query = `
        [out:json][timeout:15];
        (
            node["highway"="bus_stop"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
            node["public_transport"="stop_position"]["bus"="yes"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
            node["railway"="station"]["station"="subway"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
            node["railway"="subway_entrance"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
            node["station"="subway"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
            node["railway"="station"](around:${SEARCH_RADIUS_METERS},${lat},${lng});
        );
        out body;
    `;

    const urls = [
        OVERPASS_API_URL,
        'https://overpass.kumi.systems/api/interpreter',
    ];

    let lastError = null;

    for (const url of urls) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 18000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'CommuteX-StudentTransport/1.0',
                },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                const text = await response.text();
                lastError = new Error(`Overpass API error ${response.status} from ${url}: ${text.slice(0, 200)}`);
                continue; // try next mirror
            }

            return await response.json();
        } catch (err) {
            clearTimeout(timeout);
            lastError = err;
            // try next mirror
        }
    }

    throw lastError || new Error('All Overpass mirrors failed');
}

/**
 * Classify an OSM node as 'bus_stop' or 'metro_station'.
 */
function classifyNode(node) {
    const tags = node.tags || {};

    // Exclude subway entrances and elevators to prevent getting gate names
    // instead of the actual station name.
    if (tags.railway === 'subway_entrance' || tags.highway === 'elevator') {
        return null;
    }

    // Metro / subway / rapid transit station
    // Must be a railway station of type subway/metro, or have metro/subway in network/operator/name
    const isSubwayOrMetro = 
        tags.station === 'subway' || 
        tags.station === 'metro' || 
        tags.subway === 'yes' || 
        tags.metro === 'yes' ||
        (tags.railway === 'station' && (
            tags.station === 'subway' || 
            tags.station === 'metro' ||
            tags.network?.toLowerCase().includes('metro') ||
            tags.operator?.toLowerCase().includes('metro') ||
            tags.operator?.toLowerCase().includes('bmrcl') ||
            tags.name?.toLowerCase().includes('metro station')
        ));

    if (isSubwayOrMetro) {
        return 'metro';
    }

    // Bus stop
    if (
        tags.highway === 'bus_stop' ||
        (tags.public_transport === 'stop_position' && tags.bus === 'yes')
    ) {
        return 'bus';
    }

    return null;
}

/**
 * GET /api/nearby-transit?lat=12.9716&lng=77.5946
 * Returns the nearest bus stop and metro station with distances.
 */
router.get('/', async (req, res) => {
    try {
        const { lat, lng } = req.query;

        // Validate coordinates
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({
                success: false,
                message: 'lat and lng query parameters are required and must be valid numbers',
            });
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coordinates. lat must be -90..90, lng must be -180..180',
            });
        }

        console.log(`📍 Searching transit near (${latitude}, ${longitude})...`);

        // Query Overpass API
        const overpassData = await queryOverpass(latitude, longitude);
        const elements = overpassData.elements || [];

        console.log(`   Found ${elements.length} transit nodes from Overpass`);

        // Classify and calculate distances
        let nearestBus = null;
        let nearestMetro = null;

        for (const node of elements) {
            if (!node.lat || !node.lon) continue;

            const type = classifyNode(node);
            if (!type) continue;

            const distKm = haversineKm(latitude, longitude, node.lat, node.lon);
            const name = node.tags?.name || node.tags?.description || 'Unnamed stop';

            if (type === 'bus') {
                if (!nearestBus || distKm < nearestBus.distance_km) {
                    nearestBus = {
                        name,
                        distance_km: Math.round(distKm * 100) / 100,
                        lat: node.lat,
                        lng: node.lon,
                    };
                }
            } else if (type === 'metro') {
                if (!nearestMetro || distKm < nearestMetro.distance_km) {
                    nearestMetro = {
                        name,
                        distance_km: Math.round(distKm * 100) / 100,
                        lat: node.lat,
                        lng: node.lon,
                    };
                }
            }
        }

        return res.json({
            success: true,
            data: {
                nearest_bus_stop: nearestBus,
                nearest_metro: nearestMetro,
                user_coordinates: { lat: latitude, lng: longitude },
                search_radius_km: SEARCH_RADIUS_METERS / 1000,
                total_stops_found: elements.length,
            },
        });
    } catch (error) {
        console.error('Nearby transit error:', error.message);

        // Distinguish between Overpass failures and other errors
        if (error.name === 'AbortError') {
            return res.status(504).json({
                success: false,
                message: 'Transit search timed out. The Overpass API may be busy — please try again.',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to search for nearby transit stops',
        });
    }
});

module.exports = router;
