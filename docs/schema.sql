-- ============================================================
--  CommuteX / TransitIQ — Supabase SQL Schema  (FINAL)
--  Run this entire file in the Supabase SQL Editor:
--  Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================


-- ============================================================
--  1. ENUM TYPES
--     Strongly-typed columns that match the validation rules
--     defined in backend/routes/submissions.js
-- ============================================================

CREATE TYPE transport_mode_enum AS ENUM (
    'Bus',
    'Bike',
    'Car',
    'Metro',
    'Auto',
    'Walking'
);

CREATE TYPE gender_enum AS ENUM (
    'Male',
    'Female',
    'Other'
);

CREATE TYPE weather_preference_enum AS ENUM (
    'Sunny',
    'Rainy',
    'Any'
);

CREATE TYPE travel_type_enum AS ENUM (
    'Solo',
    'Group'
);


-- ============================================================
--  2. LOOKUP TABLE: dummy_pricing
--     One row per transport mode. Stores the coefficients used
--     by the recommendation engine (Phase 3) to estimate cost,
--     travel time, and score each mode.
--
--     Columns:
--       base_cost_per_km     — base fare in ₹ per km
--       avg_speed_kmh        — typical speed; used to estimate travel time
--       weather_penalty_rainy — cost/time multiplier applied on rainy days
--                              (1.0 = no change, 1.5 = 50% worse)
--       group_discount       — cost multiplier when travel_type = 'Group'
--                              (1.0 = no discount, 0.8 = 20% cheaper)
--       comfort_score        — subjective comfort rating 1–10
--       eco_score            — environmental friendliness rating 1–10
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dummy_pricing (
    id                      SERIAL          PRIMARY KEY,
    transport_mode          VARCHAR(20)     NOT NULL UNIQUE,
    base_cost_per_km        NUMERIC(6, 2)   NOT NULL,
    avg_speed_kmh           NUMERIC(5, 1)   NOT NULL,
    weather_penalty_rainy   NUMERIC(3, 2)   NOT NULL DEFAULT 1.0,
    group_discount          NUMERIC(3, 2)   NOT NULL DEFAULT 1.0,
    comfort_score           INTEGER         NOT NULL DEFAULT 5
                                            CHECK (comfort_score BETWEEN 1 AND 10),
    eco_score               INTEGER         NOT NULL DEFAULT 5
                                            CHECK (eco_score BETWEEN 1 AND 10)
) TABLESPACE pg_default;


-- ============================================================
--  3. SEED DATA: dummy_pricing
--     Six rows — one per transport mode.
--     These are the values from dummy_pricing_rows.csv.
-- ============================================================

INSERT INTO public.dummy_pricing
    (id, transport_mode, base_cost_per_km, avg_speed_kmh,
     weather_penalty_rainy, group_discount, comfort_score, eco_score)
VALUES
    --  id  mode       ₹/km  kmh   rain  grp   comfort  eco
    (1, 'Bus',     3.00, 20.0, 1.10, 0.80,  5,  8),
    (2, 'Bike',    2.00, 30.0, 1.50, 1.00,  4,  7),
    (3, 'Car',     8.00, 35.0, 1.05, 0.60,  9,  3),
    (4, 'Metro',   2.50, 40.0, 1.00, 0.85,  7,  9),
    (5, 'Auto',    6.00, 25.0, 1.20, 0.75,  6,  5),
    (6, 'Walking', 0.00,  5.0, 2.00, 1.00,  3, 10)
ON CONFLICT (id) DO NOTHING;

-- Reset the serial sequence so future inserts start after id 6
SELECT setval('public.dummy_pricing_id_seq', 6);


-- ============================================================
--  4. MAIN TABLE: student_responses
--     Stores every survey submission from the frontend form.
--     Referenced by:
--       - backend/routes/submissions.js  (INSERT)
--       - backend/routes/analytics.js   (SELECT count)
--       - backend/config/supabase.js    (health-check SELECT)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_responses (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT                    NOT NULL CHECK (char_length(trim(name)) >= 2),
    age                 SMALLINT                NOT NULL CHECK (age BETWEEN 10 AND 60),
    gender              gender_enum             NOT NULL,
    distance_km         NUMERIC(6, 2)           NOT NULL CHECK (distance_km BETWEEN 0.1 AND 100),
    transport_mode      transport_mode_enum     NOT NULL,
    travel_time_min     SMALLINT                NOT NULL CHECK (travel_time_min BETWEEN 1 AND 300),
    monthly_cost        NUMERIC(8, 2)           NOT NULL CHECK (monthly_cost BETWEEN 0 AND 50000),
    weather_preference  weather_preference_enum NOT NULL,
    travel_type         travel_type_enum        NOT NULL,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_student_responses_transport_mode
    ON public.student_responses (transport_mode);

CREATE INDEX IF NOT EXISTS idx_student_responses_created_at
    ON public.student_responses (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_responses_gender
    ON public.student_responses (gender);


-- ============================================================
--  5. ROW LEVEL SECURITY (RLS)
--     Allows the anon (public) key to read and write.
--     Tighten these policies before going to production.
-- ============================================================

-- dummy_pricing: read-only for everyone (it's reference data)
ALTER TABLE public.dummy_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select_pricing"
    ON public.dummy_pricing
    FOR SELECT
    TO anon
    USING (true);

-- student_responses: anyone can insert a survey & read analytics
ALTER TABLE public.student_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_insert_responses"
    ON public.student_responses
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "allow_public_select_responses"
    ON public.student_responses
    FOR SELECT
    TO anon
    USING (true);


-- ============================================================
--  6. HELPER VIEW: analytics_summary
--     Joins dummy_pricing with live response aggregates.
--     Powers the Phase 3 dashboard and recommendation engine.
-- ============================================================

CREATE OR REPLACE VIEW public.analytics_summary AS
SELECT
    sr.transport_mode,
    COUNT(*)                                        AS response_count,
    ROUND(AVG(sr.distance_km)::NUMERIC, 2)          AS avg_distance_km,
    ROUND(AVG(sr.travel_time_min)::NUMERIC, 1)      AS avg_travel_time_min,
    ROUND(AVG(sr.monthly_cost)::NUMERIC, 2)         AS avg_monthly_cost,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (),
        2
    )                                               AS pct_of_total,
    -- Pricing metadata from the lookup table
    dp.base_cost_per_km,
    dp.avg_speed_kmh,
    dp.weather_penalty_rainy,
    dp.group_discount,
    dp.comfort_score,
    dp.eco_score
FROM public.student_responses sr
LEFT JOIN public.dummy_pricing dp
    ON sr.transport_mode::TEXT = dp.transport_mode
GROUP BY
    sr.transport_mode,
    dp.base_cost_per_km,
    dp.avg_speed_kmh,
    dp.weather_penalty_rainy,
    dp.group_discount,
    dp.comfort_score,
    dp.eco_score
ORDER BY response_count DESC;


-- ============================================================
--  7. OPTIONAL SEED DATA — student_responses
--     Uncomment to pre-populate for local dev / testing.
-- ============================================================

/*
INSERT INTO public.student_responses
    (name, age, gender, distance_km, transport_mode,
     travel_time_min, monthly_cost, weather_preference, travel_type)
VALUES
    ('Arjun Kumar',  21, 'Male',    8.5, 'Bus',     35, 1200, 'Any',   'Solo'),
    ('Priya Sharma', 19, 'Female',  3.2, 'Bike',    15,  300, 'Sunny', 'Solo'),
    ('Rohan Mehta',  22, 'Male',   14.0, 'Metro',   45, 1800, 'Any',   'Solo'),
    ('Sneha Patel',  20, 'Female',  1.0, 'Walking', 12,    0, 'Sunny', 'Group'),
    ('Vikram Singh', 23, 'Male',   22.5, 'Car',     50, 4500, 'Any',   'Solo'),
    ('Anjali Rao',   18, 'Female',  6.0, 'Auto',    25,  900, 'Rainy', 'Solo'),
    ('Dev Nair',     21, 'Male',    5.5, 'Bus',     30, 1100, 'Any',   'Group'),
    ('Meera Iyer',   20, 'Female',  9.0, 'Metro',   40, 1600, 'Any',   'Solo');
*/
