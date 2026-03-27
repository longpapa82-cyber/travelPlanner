-- Fix AI Counter for test account
-- Bug: AI counter was decremented even when trip creation failed
-- This script restores the AI counter for affected users

-- Check current status
SELECT email, aiTripsUsedThisMonth, subscriptionTier, role
FROM users
WHERE email = 'j090723@naver.com';

-- Reset AI counter to 0 (giving back 3 trips)
UPDATE users
SET aiTripsUsedThisMonth = 0
WHERE email = 'j090723@naver.com';

-- Verify the update
SELECT email, aiTripsUsedThisMonth, subscriptionTier, role
FROM users
WHERE email = 'j090723@naver.com';

-- Note: Run this on production database
-- ssh root@46.62.201.127
-- docker exec -it travelplanner-db psql -U postgres -d travelplanner