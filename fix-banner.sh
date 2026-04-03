#!/bin/bash

# Fix SmartAppBanner to show after 500ms and re-show after 4 hours

echo "Fixing SmartAppBanner in all HTML files..."

# Create the updated dismiss check function
cat > /tmp/dismiss-function.txt << 'EOF'
  // Utility: Check if banner was dismissed recently (within 4 hours)
  function wasDismissedRecently() {
    const dismissedTime = localStorage.getItem(CONFIG.storageKeys.dismissed);
    if (!dismissedTime) return false;

    const fourHours = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    const now = Date.now();
    const dismissedAt = parseInt(dismissedTime, 10);

    return (now - dismissedAt) < fourHours;
  }
EOF

# Function to update a single file
update_file() {
    local file=$1
    echo "Processing $file..."

    # First backup the file
    cp "$file" "${file}.bak"

    # Replace wasDismissedToday with wasDismissedRecently implementation
    sed -i '/function wasDismissedToday()/,/return dismissed === today;/c\
  // Utility: Check if banner was dismissed recently (within 4 hours)\
  function wasDismissedRecently() {\
    const dismissedTime = localStorage.getItem(CONFIG.storageKeys.dismissed);\
    if (!dismissedTime) return false;\
    \
    const fourHours = 4 * 60 * 60 * 1000; // 4 hours in milliseconds\
    const now = Date.now();\
    const dismissedAt = parseInt(dismissedTime, 10);\
    \
    return (now - dismissedAt) < fourHours;' "$file"

    # Replace all wasDismissedToday calls with wasDismissedRecently
    sed -i 's/wasDismissedToday/wasDismissedRecently/g' "$file"

    # Update setTimeout delay to 500ms
    sed -i 's/setTimeout(showBanner, 2000)/setTimeout(showBanner, 500)/g' "$file"
    sed -i 's/showDelay: 2000/showDelay: 500/g' "$file"

    # Update handleBannerDismiss to store timestamp instead of date string
    sed -i "/localStorage\.setItem(CONFIG\.storageKeys\.dismissed/c\    localStorage.setItem(CONFIG.storageKeys.dismissed, Date.now().toString());" "$file"

    echo "✓ Updated $file"
}

# Update landing pages
update_file "/root/travelPlanner/frontend/public/landing.html"
update_file "/root/travelPlanner/frontend/public/landing-en.html"

# Update all guide pages
for file in /root/travelPlanner/frontend/public/guides/*.html; do
    if [ -f "$file" ]; then
        update_file "$file"
    fi
done

# Update FAQ if it has the banner
if grep -q "SmartAppBanner" /root/travelPlanner/frontend/public/faq.html 2>/dev/null; then
    update_file "/root/travelPlanner/frontend/public/faq.html"
fi

echo ""
echo "✅ All files updated successfully!"
echo ""
echo "Changes made:"
echo "1. Banner now shows after 500ms (was 2000ms)"
echo "2. Banner re-appears after 4 hours (was 24 hours)"
echo "3. Using timestamp-based dismissal tracking"
echo ""
echo "The changes are immediately effective because files are volume-mounted."