#!/bin/bash

# Test script to trigger ThrottlerException on signup endpoint
# Configured limit: 20 requests per minute

API_URL="${API_URL:-http://localhost:3000/api}"
echo "Testing ThrottlerException logging at $API_URL"
echo "---"

# Function to attempt signup
attempt_signup() {
  local index=$1
  local response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test${index}@example.com\",\"password\":\"Test123!\",\"name\":\"Test User ${index}\"}" \
    "${API_URL}/auth/register" 2>/dev/null)

  local http_code=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "429" ]; then
    echo "⚠️  Request $index: Rate limited (429)"
  elif [ "$http_code" = "201" ]; then
    echo "✅ Request $index: Success (201)"
  elif [ "$http_code" = "409" ]; then
    echo "ℹ️  Request $index: User exists (409)"
  elif [ "$http_code" = "400" ]; then
    echo "❌ Request $index: Validation error (400)"
  else
    echo "❌ Request $index: Failed ($http_code)"
  fi
}

# Make 25 rapid requests (exceeding the 20/minute limit)
echo "Making 25 rapid requests to trigger rate limiting..."
for i in {1..25}; do
  attempt_signup $i &
  sleep 0.05  # Small delay between requests
done

# Wait for all background jobs
wait

echo "---"
echo "✅ Test complete!"
echo ""
echo "To verify error logging:"
echo "1. Check database: SELECT * FROM error_logs WHERE error_message LIKE '%Too Many%' ORDER BY created_at DESC;"
echo "2. Or check admin dashboard at ${API_URL}/admin/errors"