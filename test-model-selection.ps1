#!/bin/pwsh

# Test which model is being used
Write-Host "Testing lesson generation to see model selection logging..."
Write-Host ""
Write-Host "Making request to /api/ai/coaching..."
Write-Host ""

$body = @{
    subject = "Mathematics"
    topic = "Quadratic Equations"
    format = "textbook"
    refresh = $false
    cacheOnly = $false
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/ai/coaching" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -ErrorAction SilentlyContinue

Write-Host "HTTP Status: $($response.StatusCode)"
Write-Host ""
Write-Host "Response (first 500 chars):"
Write-Host $response.Content.Substring(0, [Math]::Min(500, $response.Content.Length))
Write-Host ""
Write-Host "Check the dev server console for logging output showing:"
Write-Host "  - [getModelForTask] Selecting LESSON tier model: ..."  
Write-Host "  - [callWithFallback] Selected model for tier lesson: ..."
Write-Host "  - [AICoach] Using model: ..."
Write-Host "  - [AICoach] Response model from OpenRouter: ..."
Write-Host "  - [AICoach] Recording usage with model: ..."
