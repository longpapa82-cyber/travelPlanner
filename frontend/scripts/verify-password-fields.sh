#!/bin/bash

# Script to verify all password fields have correct autoComplete settings
# This prevents browser-like password save dialogs in native Android app

echo "Verifying password field configurations..."
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for problematic autoComplete values on password fields
echo "Checking for problematic autoComplete values on password fields..."
ISSUES=$(grep -rn "autoComplete.*password" --include="*.tsx" --include="*.ts" src/)

if [ -z "$ISSUES" ]; then
    echo -e "${GREEN}✅ No problematic autoComplete=\"*password\" found${NC}"
else
    echo -e "${RED}❌ Found password fields with problematic autoComplete:${NC}"
    echo "$ISSUES"
fi

echo ""

# Check that all secureTextEntry fields have proper configuration
echo "Checking all password fields (secureTextEntry) have proper settings..."
echo ""

# Find all files with secureTextEntry
FILES_WITH_PASSWORD=$(grep -l "secureTextEntry" --include="*.tsx" src/)

MISSING_CONFIG=0

for file in $FILES_WITH_PASSWORD; do
    echo "Checking $file..."

    # Extract TextInput blocks with secureTextEntry
    # Look for TextInput blocks and check if they have autoComplete="off" and importantForAutofill="no"

    # Count secureTextEntry occurrences
    SECURE_COUNT=$(grep -c "secureTextEntry" "$file")

    # Count autoComplete="off" near secureTextEntry (within 5 lines)
    AUTOCOMPLETE_COUNT=$(grep -B5 -A5 "secureTextEntry" "$file" | grep -c "autoComplete=\"off\"")

    # Count importantForAutofill="no" near secureTextEntry
    AUTOFILL_COUNT=$(grep -B5 -A5 "secureTextEntry" "$file" | grep -c "importantForAutofill=\"no\"")

    if [ "$SECURE_COUNT" -ne "$AUTOCOMPLETE_COUNT" ] || [ "$SECURE_COUNT" -ne "$AUTOFILL_COUNT" ]; then
        echo -e "${YELLOW}  ⚠️  May be missing proper configuration:${NC}"
        echo "      Password fields: $SECURE_COUNT"
        echo "      autoComplete=\"off\": $AUTOCOMPLETE_COUNT"
        echo "      importantForAutofill=\"no\": $AUTOFILL_COUNT"
        MISSING_CONFIG=$((MISSING_CONFIG + 1))
    else
        echo -e "${GREEN}  ✅ All password fields properly configured${NC}"
    fi
    echo ""
done

echo "========================================="
echo "Summary:"
echo ""

if [ $MISSING_CONFIG -eq 0 ]; then
    echo -e "${GREEN}✅ All password fields are properly configured!${NC}"
    echo "   - autoComplete is set to \"off\" for all password fields"
    echo "   - importantForAutofill is set to \"no\" for all password fields"
    echo "   - No browser-like password save dialogs should appear"
else
    echo -e "${YELLOW}⚠️  Some files may need attention${NC}"
    echo "   Please review the files above and ensure all password fields have:"
    echo "   - autoComplete=\"off\""
    echo "   - importantForAutofill=\"no\""
    echo "   - autoCapitalize=\"none\""
fi

echo ""
echo "Note: The core Input component handles password fields automatically"
echo "when type=\"password\" is used."