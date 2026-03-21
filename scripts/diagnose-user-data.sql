-- Phase 1: Diagnose User Data for hoonjae072@mail.com
-- Purpose: Verify actual trip count and quota usage
-- Date: 2026-03-21

-- 1. User quota status
SELECT
  id,
  email,
  name,
  "subscriptionTier",
  "aiTripsUsedThisMonth",
  "createdAt"
FROM users
WHERE email = 'hoonjae072@mail.com';

-- 2. All trips created by this user (ordered by creation time)
SELECT
  id,
  destination,
  "startDate",
  "endDate",
  "planningMode",
  "aiStatus",
  "createdAt",
  EXTRACT(EPOCH FROM "createdAt") AS created_timestamp
FROM trips
WHERE "userId" = (SELECT id FROM users WHERE email = 'hoonjae072@mail.com')
ORDER BY "createdAt" DESC;

-- 3. Detect potential duplicates (trips created within 5 seconds of each other)
WITH trip_times AS (
  SELECT
    id,
    destination,
    "createdAt",
    LAG("createdAt") OVER (ORDER BY "createdAt") AS prev_created,
    EXTRACT(EPOCH FROM ("createdAt" - LAG("createdAt") OVER (ORDER BY "createdAt"))) AS seconds_diff
  FROM trips
  WHERE "userId" = (SELECT id FROM users WHERE email = 'hoonjae072@mail.com')
)
SELECT
  id,
  destination,
  "createdAt",
  prev_created,
  seconds_diff,
  CASE
    WHEN seconds_diff < 5 THEN '⚠️ POTENTIAL DUPLICATE'
    ELSE 'OK'
  END AS status
FROM trip_times
WHERE prev_created IS NOT NULL
ORDER BY "createdAt" DESC;

-- 4. Count trips by planning mode
SELECT
  "planningMode",
  COUNT(*) as trip_count
FROM trips
WHERE "userId" = (SELECT id FROM users WHERE email = 'hoonjae072@mail.com')
GROUP BY "planningMode";

-- 5. Summary report
SELECT
  (SELECT COUNT(*) FROM trips WHERE "userId" = (SELECT id FROM users WHERE email = 'hoonjae072@mail.com')) AS total_trips,
  (SELECT "aiTripsUsedThisMonth" FROM users WHERE email = 'hoonjae072@mail.com') AS quota_used,
  (SELECT COUNT(*) FROM trips WHERE "userId" = (SELECT id FROM users WHERE email = 'hoonjae072@mail.com') AND "planningMode" = 'ai') AS ai_trips_actual;
