#!/bin/bash

# Test which model is being used
echo "Testing lesson generation to see model selection logging..."
echo ""
echo "Making request to /api/ai/coaching..."
echo ""

curl -X POST http://localhost:3001/api/ai/coaching \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Mathematics",
    "topic": "Quadratic Equations",
    "format": "textbook",
    "refresh": false,
    "cacheOnly": false
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | head -100

echo ""
echo "Check the dev server console for logging output showing:"
echo "  - [getModelForTask] Selecting LESSON tier model: ..."  
echo "  - [callWithFallback] Selected model for tier lesson: ..."
echo "  - [AICoach] Using model: ..."
echo "  - [AICoach] Response model from OpenRouter: ..."
echo "  - [AICoach] Recording usage with model: ..."
