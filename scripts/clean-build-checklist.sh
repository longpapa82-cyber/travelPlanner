#!/bin/bash

# TravelPlanner Clean Build Checklist
# Purpose: Ensure consistent builds between local and EAS
# Created: 2026-04-05

set -e

echo "🚀 TravelPlanner Clean Build Checklist"
echo "======================================"

# Phase 1: Git Status Check
echo ""
echo "📋 Phase 1: Git Status Check"
echo "----------------------------"

# Check uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ WARNING: Uncommitted changes detected!"
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/n): " commit_choice
    if [[ $commit_choice == "y" ]]; then
        git add -A
        git commit -m "chore: prepare for clean build (versionCode $(grep versionCode frontend/app.json | grep -o '[0-9]*'))"
        echo "✅ Changes committed"
    fi
else
    echo "✅ No uncommitted changes"
fi

# Check unpushed commits
unpushed=$(git log origin/main..HEAD --oneline | wc -l)
if [[ $unpushed -gt 0 ]]; then
    echo "⚠️  WARNING: $unpushed unpushed commits detected!"
    git log origin/main..HEAD --oneline | head -5
    echo ""
    read -p "Do you want to push these commits? (y/n): " push_choice
    if [[ $push_choice == "y" ]]; then
        git push origin main
        echo "✅ Commits pushed"
    fi
else
    echo "✅ All commits pushed"
fi

# Phase 2: Cache Cleanup
echo ""
echo "🧹 Phase 2: Cache Cleanup"
echo "------------------------"

echo "Cleaning Metro bundler cache..."
cd frontend

# Clean Metro cache
npx expo start --clear 2>/dev/null &
EXPO_PID=$!
sleep 5
kill $EXPO_PID 2>/dev/null || true
echo "✅ Metro cache cleared"

# Clean Watchman
if command -v watchman &> /dev/null; then
    watchman watch-del-all 2>/dev/null || true
    echo "✅ Watchman cache cleared"
fi

# Clean node_modules (optional)
read -p "Do you want to reinstall node_modules? (y/n): " reinstall_choice
if [[ $reinstall_choice == "y" ]]; then
    rm -rf node_modules
    rm -f package-lock.json
    npm install
    echo "✅ node_modules reinstalled"
fi

# Phase 3: Environment Variables
echo ""
echo "🔐 Phase 3: Environment Variables"
echo "---------------------------------"

# Check .env file
if [[ ! -f .env ]]; then
    echo "❌ WARNING: .env file not found!"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with production values"
else
    echo "✅ .env file exists"
fi

# Verify critical environment variables
required_vars=(
    "EXPO_PUBLIC_API_URL"
    "ADMOB_ANDROID_APP_ID"
    "ADMOB_IOS_APP_ID"
)

for var in "${required_vars[@]}"; do
    if grep -q "^$var=" .env; then
        echo "✅ $var is set"
    else
        echo "❌ WARNING: $var is not set in .env!"
    fi
done

# Phase 4: Version Check
echo ""
echo "📱 Phase 4: Version Check"
echo "------------------------"

current_version=$(grep versionCode app.json | grep -o '[0-9]*')
echo "Current versionCode: $current_version"
read -p "Do you want to increment versionCode? (y/n): " version_choice
if [[ $version_choice == "y" ]]; then
    new_version=$((current_version + 1))
    sed -i '' "s/\"versionCode\": $current_version/\"versionCode\": $new_version/" app.json
    echo "✅ versionCode updated to $new_version"
    git add app.json
    git commit -m "chore: bump versionCode to $new_version"
fi

# Phase 5: EAS Build Preparation
echo ""
echo "🏗️ Phase 5: EAS Build Preparation"
echo "---------------------------------"

# Check EAS configuration
if [[ ! -f eas.json ]]; then
    echo "❌ WARNING: eas.json not found!"
else
    echo "✅ eas.json exists"
fi

# Verify EAS login
if ! eas whoami &>/dev/null; then
    echo "⚠️  Not logged in to EAS"
    eas login
else
    echo "✅ Logged in to EAS"
fi

# Phase 6: Pre-Build Validation
echo ""
echo "✅ Phase 6: Pre-Build Validation"
echo "--------------------------------"

# TypeScript check
echo "Running TypeScript check..."
if npx tsc --noEmit; then
    echo "✅ TypeScript check passed"
else
    echo "❌ TypeScript errors detected! Fix before building."
    exit 1
fi

# Test critical functionality locally
echo ""
echo "📋 Manual Test Checklist:"
echo "------------------------"
echo "[ ] 1. Test Google Sign-In locally"
echo "[ ] 2. Test ad display (use test device)"
echo "[ ] 3. Test place autocomplete selection"
echo "[ ] 4. Test invitation notifications"
echo "[ ] 5. Test profile image upload"
echo ""

read -p "Have you completed all manual tests? (y/n): " test_choice
if [[ $test_choice != "y" ]]; then
    echo "⚠️  Please complete manual testing before building"
    exit 1
fi

# Phase 7: Build Command
echo ""
echo "🚀 Phase 7: Ready to Build"
echo "-------------------------"
echo ""
echo "Build commands:"
echo ""
echo "For Alpha testing:"
echo "  eas build --platform android --profile preview"
echo ""
echo "For Production:"
echo "  eas build --platform android --profile production"
echo ""
echo "After build completes:"
echo "1. Download the APK/AAB"
echo "2. Test on physical device"
echo "3. Submit to Play Store if tests pass"
echo ""

cd ..
echo "✅ Clean build checklist complete!"