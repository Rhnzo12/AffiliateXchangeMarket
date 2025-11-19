#!/bin/bash
# Quick UTM Tracking Test Script
# This script tests the UTM parameter tracking functionality

echo "🧪 UTM Parameter Tracking - Quick Test"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "1️⃣  Checking if server is running..."
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running${NC}"
    echo "   Please start the server with: npm run dev"
    exit 1
fi

echo ""
echo "2️⃣  You need a tracking code to test."
echo "   Example: CR-12345678-87654321"
echo ""
read -p "Enter your tracking code (or press Enter to skip manual tests): " TRACKING_CODE

if [ -z "$TRACKING_CODE" ]; then
    echo ""
    echo -e "${YELLOW}⚠ No tracking code provided - skipping manual tests${NC}"
    echo ""
    echo "To get a tracking code:"
    echo "1. Login as a creator and apply to an offer"
    echo "2. Login as the company and approve the application"
    echo "3. The tracking link will be generated (format: /go/CR-xxx-yyy)"
    echo ""
else
    BASE_URL="http://localhost:5000"

    echo ""
    echo "3️⃣  Testing UTM tracking with different scenarios..."
    echo ""

    # Test 1: All UTM parameters
    echo "Test 1: Full UTM parameters"
    echo "URL: ${BASE_URL}/go/${TRACKING_CODE}?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale&utm_term=deals&utm_content=video"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/go/${TRACKING_CODE}?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale&utm_term=deals&utm_content=video")

    if [ "$RESPONSE" -eq 302 ] || [ "$RESPONSE" -eq 200 ]; then
        echo -e "${GREEN}✓ Redirect successful (HTTP $RESPONSE)${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $RESPONSE)${NC}"
    fi

    sleep 1
    echo ""

    # Test 2: Partial UTM parameters
    echo "Test 2: Partial UTM (source + medium only)"
    echo "URL: ${BASE_URL}/go/${TRACKING_CODE}?utm_source=google&utm_medium=email"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/go/${TRACKING_CODE}?utm_source=google&utm_medium=email")

    if [ "$RESPONSE" -eq 302 ] || [ "$RESPONSE" -eq 200 ]; then
        echo -e "${GREEN}✓ Redirect successful (HTTP $RESPONSE)${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $RESPONSE)${NC}"
    fi

    sleep 1
    echo ""

    # Test 3: No UTM parameters
    echo "Test 3: No UTM parameters"
    echo "URL: ${BASE_URL}/go/${TRACKING_CODE}"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/go/${TRACKING_CODE}")

    if [ "$RESPONSE" -eq 302 ] || [ "$RESPONSE" -eq 200 ]; then
        echo -e "${GREEN}✓ Redirect successful (HTTP $RESPONSE)${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $RESPONSE)${NC}"
    fi

    sleep 1
    echo ""

    # Test 4: Special characters
    echo "Test 4: Special characters in UTM"
    echo "URL: ${BASE_URL}/go/${TRACKING_CODE}?utm_campaign=2024%20Summer%20Sale&utm_content=50%25%20OFF"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/go/${TRACKING_CODE}?utm_campaign=2024%20Summer%20Sale&utm_content=50%25%20OFF")

    if [ "$RESPONSE" -eq 302 ] || [ "$RESPONSE" -eq 200 ]; then
        echo -e "${GREEN}✓ Redirect successful (HTTP $RESPONSE)${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $RESPONSE)${NC}"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "4️⃣  Next Steps - Verify in Database:"
echo ""
echo "Connect to your database and run:"
echo ""
echo "SELECT"
echo "  ip_address,"
echo "  utm_source,"
echo "  utm_medium,"
echo "  utm_campaign,"
echo "  utm_term,"
echo "  utm_content,"
echo "  timestamp"
echo "FROM click_events"
echo "ORDER BY timestamp DESC"
echo "LIMIT 5;"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected Results:"
echo "• All clicks should show HTTP 302 (redirect)"
echo "• Database should contain UTM parameters"
echo "• Missing parameters should be NULL"
echo "• Server console should show click logging"
echo ""
echo "📚 For detailed testing guide, see: UTM_TRACKING_TEST_GUIDE.md"
echo ""
