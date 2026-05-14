#!/bin/bash
# Test script to validate the new Phase 3 tools

echo "🔍 PHASE 3 VALIDATION SCRIPT"
echo "============================"
echo ""
echo "This script validates that the new tools are properly integrated."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend directory exists
if [ ! -d "backend" ]; then
  echo -e "${RED}❌ backend directory not found${NC}"
  exit 1
fi

cd backend

# Check critical files
echo "Checking critical files..."
echo ""

FILES_TO_CHECK=(
  "ai/tools/dependency-traversal.tool.js"
  "ai/tools/systemic-impact.tool.js"
  "ai/agent/toolImplementations.js"
  "ai/agent/executor.service.js"
  "ai/agent/planner.service.js"
  "ai/agent/validate-tools.js"
)

MISSING_FILES=0

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $file${NC}"
  else
    echo -e "${RED}❌ $file${NC}"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

echo ""

if [ $MISSING_FILES -gt 0 ]; then
  echo -e "${RED}❌ Missing $MISSING_FILES files${NC}"
  exit 1
fi

# Check that new tools are imported in toolImplementations.js
echo "Checking tool imports..."
echo ""

if grep -q "findTransitiveDependencies" "ai/agent/toolImplementations.js"; then
  echo -e "${GREEN}✅ findTransitiveDependencies imported${NC}"
else
  echo -e "${RED}❌ findTransitiveDependencies NOT imported${NC}"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

if grep -q "analyzeSytemicImpact" "ai/agent/toolImplementations.js"; then
  echo -e "${GREEN}✅ analyzeSytemicImpact imported${NC}"
else
  echo -e "${RED}❌ analyzeSytemicImpact NOT imported${NC}"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

echo ""

# Check planner mentions new tools
echo "Checking planner configuration..."
echo ""

if grep -q "findTransitiveDependencies" "ai/agent/planner.service.js"; then
  echo -e "${GREEN}✅ findTransitiveDependencies documented in planner${NC}"
else
  echo -e "${RED}❌ findTransitiveDependencies NOT in planner${NC}"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

if grep -q "analyzeSytemicImpact" "ai/agent/planner.service.js"; then
  echo -e "${GREEN}✅ analyzeSytemicImpact documented in planner${NC}"
else
  echo -e "${RED}❌ analyzeSytemicImpact NOT in planner${NC}"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

echo ""

# Check executor has logging
echo "Checking executor improvements..."
echo ""

if grep -q "logger.info.*Executing tool" "ai/agent/executor.service.js"; then
  echo -e "${GREEN}✅ Executor has execution logging${NC}"
else
  echo -e "${RED}❌ Executor missing execution logging${NC}"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

echo ""
echo "============================"

if [ $MISSING_FILES -eq 0 ]; then
  echo -e "${GREEN}✅ ALL VALIDATION CHECKS PASSED${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Start the backend: npm run dev"
  echo "2. Run validation: node ai/agent/validate-tools.js"
  echo "3. Test with query: 'Mostrame todas las dependencias transitivas de profundidad 3 de [symbol]'"
  echo "4. Check backend logs for real tool execution"
  exit 0
else
  echo -e "${RED}❌ VALIDATION FAILED - $MISSING_FILES issues found${NC}"
  exit 1
fi
