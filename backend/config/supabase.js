/* =====================================================
   Supabase Client Configuration
   Uses direct REST API calls instead of the JS SDK
   to avoid ConnectTimeoutError on some networks.
   ===================================================== */

const dns = require('dns');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const SUPABASE_REQUEST_TIMEOUT_MS = 2500;
const SUPABASE_RETRY_DELAYS_MS = [250, 600];

// Prefer IPv4 to avoid intermittent DNS/IPv6 connectivity failures.
dns.setDefaultResultOrder('ipv4first');

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  WARNING: Required database settings are missing.');
    console.warn('   The app will run but database operations will fail.');
    console.warn('   Please set these in your .env file.');
}

/**
 * Lightweight Supabase REST client using native fetch.
 * This avoids the @supabase/supabase-js SDK's internal connection
 * issues on certain networks (IPv6/timeout problems).
 */
const supabase = (supabaseUrl && supabaseKey) ? {
    _baseUrl: `${supabaseUrl}/rest/v1`,
    _headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    },

    /**
     * Query a table
     * @param {string} table - Table name
     * @returns query builder object
     */
    from(table) {
        const self = this;
        let queryParams = [];
        let selectCols = '*';
        let countMode = null;
        let headOnly = false;
        let limitVal = null;

        const builder = {
            select(columns = '*', options = {}) {
                selectCols = columns;
                if (options.count) countMode = options.count;
                if (options.head) headOnly = options.head;
                return builder;
            },

            eq(column, value) {
                queryParams.push(`${column}=eq.${value}`);
                return builder;
            },

            limit(n) {
                limitVal = n;
                return builder;
            },

            single() {
                limitVal = 1;
                builder._single = true;
                return builder.then(({ data, error }) => {
                    if (error) return { data: null, error };
                    return { data: data && data[0] ? data[0] : null, error: null };
                });
            },

            async insert(rows) {
                try {
                    const response = await supabaseFetchWithRetry(`${self._baseUrl}/${table}`, {
                        method: 'POST',
                        headers: self._headers,
                        body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
                    });
                    
                    if (!response.ok) {
                        const errBody = await response.text();
                        return { data: null, error: { message: errBody, code: response.status } };
                    }
                    
                    const data = await response.json();
                    
                    // Return a chainable object for .select().single() pattern
                    return {
                        data,
                        error: null,
                        select(cols) {
                            return {
                                single() {
                                    return Promise.resolve({
                                        data: data && data[0] ? data[0] : null,
                                        error: null,
                                    });
                                },
                                then(resolve) {
                                    return resolve({ data, error: null });
                                }
                            };
                        }
                    };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },

            async then(resolve) {
                try {
                    let url = `${self._baseUrl}/${table}?select=${selectCols}`;
                    queryParams.forEach(p => { url += `&${p}`; });
                    if (limitVal) url += `&limit=${limitVal}`;

                    const headers = { ...self._headers };
                    if (countMode) {
                        headers['Prefer'] = `count=${countMode}`;
                    }

                    const response = await supabaseFetchWithRetry(url, {
                        method: headOnly ? 'HEAD' : 'GET',
                        headers,
                    });

                    if (!response.ok) {
                        const errBody = await response.text();
                        return resolve({ data: null, count: null, error: { message: errBody } });
                    }

                    // Parse count from content-range header
                    let count = null;
                    const contentRange = response.headers.get('content-range');
                    if (contentRange) {
                        const parts = contentRange.split('/');
                        count = parts[1] && parts[1] !== '*' ? parseInt(parts[1], 10) : null;
                    }

                    const data = headOnly ? null : await response.json();
                    return resolve({ data, count, error: null });
                } catch (err) {
                    return resolve({ data: null, count: null, error: { message: err.message } });
                }
            }
        };

        return builder;
    }
} : null;

// Test connection on startup
if (supabase) {
    supabase.from('student_responses').select('*', { count: 'exact', head: true })
        .then(({ count, error }) => {
            if (error) {
                console.error('❌ Supabase connection test FAILED:', error.message);
            } else {
                console.log(`✅ Supabase connected! (${count ?? 0} existing responses)`);
            }
        });
}

module.exports = supabase;

/**
 * Call Supabase REST with retries to handle intermittent network failures.
 */
async function supabaseFetchWithRetry(url, options) {
    let lastError = null;

    for (let attempt = 0; attempt <= SUPABASE_RETRY_DELAYS_MS.length; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            return response;
        } catch (err) {
            clearTimeout(timeout);
            lastError = err;

            if (attempt < SUPABASE_RETRY_DELAYS_MS.length) {
                await delay(SUPABASE_RETRY_DELAYS_MS[attempt]);
            }
        }
    }

    const msg = lastError && lastError.message ? lastError.message : 'request failed';
    throw new Error(`Supabase request failed after retries: ${msg}`);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
