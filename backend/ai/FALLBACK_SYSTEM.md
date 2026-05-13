# AI Provider Fallback System

## Overview

ReqTracker now uses a robust fallback system that automatically switches between OpenRouter and OpenAI providers with circuit breaker protection and automatic retries.

## Architecture

### Primary Provider: OpenRouter ✅
- **Default**: Always prioritized first
- **Models**: `openai/gpt-4o-mini` (configurable)
- **Cost**: Lower than direct OpenAI
- **Status**: Currently active

### Fallback Provider: OpenAI
- **Used when**: OpenRouter fails or circuit breaker is open
- **Models**: `gpt-4o-mini` (configurable)  
- **Cost**: Higher cost, but reliable
- **Status**: Standby/backup

## Features

### 1. **Automatic Fallback**
If OpenRouter fails:
- ✅ Retries up to 3 times with exponential backoff
- ✅ Automatically switches to OpenAI
- ✅ Returns provider name with response
- ✅ Logs all attempts for debugging

### 2. **Circuit Breaker Protection**
Prevents cascading failures:
- ⚠️ Opens after 3 consecutive failures
- ⏳ Automatically resets after 60 seconds
- 🔴 Blocks failed provider during downtime
- 📊 Tracks failure patterns

### 3. **Provider Statistics**
Real-time monitoring:
```javascript
{
  openRouter: {
    successCount: 150,
    failureCount: 2,
    avgMs: 1240
  },
  openAI: {
    successCount: 5,
    failureCount: 0,
    avgMs: 890
  }
}
```

### 4. **Retry Strategy**
Exponential backoff with jitter:
- Attempt 1: Immediate
- Attempt 2: 4 seconds (2^2)
- Attempt 3: 8 seconds (2^3)
- Retry only for: 429 (rate limit), ETIMEDOUT, ECONNREFUSED

## Configuration

### Environment Variables

```bash
# OpenRouter (Primary - REQUIRED)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_REFERER=https://reqtracker.example.com

# OpenAI (Fallback - Optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Fallback System Configuration
CIRCUIT_BREAKER_THRESHOLD=3        # Failures before circuit opens
CIRCUIT_BREAKER_RESET_MS=60000     # Reset after 60 seconds

# Other
AI_MAX_TOKENS=1024
AI_CONTINUATION_MAX_CYCLES=2
```

## Usage Examples

### Normal Operation (OpenRouter succeeds)
```
📡 AI: Attempting openRouter (attempt 1/3) with model openai/gpt-4o-mini
✅ AI: openRouter succeeded in 1240ms
```

### Fallback (OpenRouter fails → OpenAI succeeds)
```
📡 AI: Attempting openRouter (attempt 1/3) with model openai/gpt-4o-mini
❌ AI: openRouter failed (attempt 1/3): status 429, code RATE_LIMIT, isRetryable: true
⏳ AI: Retrying openRouter in 4000ms...
❌ AI: openRouter failed (attempt 2/3): status 429, code RATE_LIMIT, isRetryable: true
⏳ AI: Retrying openRouter in 8000ms...
❌ AI: openRouter failed (attempt 3/3): status 429, code RATE_LIMIT, isRetryable: false
🔴 Circuit breaker OPEN for openRouter after 3 failures
📡 AI: Attempting openAI (attempt 1/3) with model gpt-4o-mini
✅ AI: openAI succeeded in 890ms
```

### Circuit Breaker in Action
```
📡 AI: Attempting openRouter (attempt 1/3)
❌ AI: openRouter failed
🔴 Circuit breaker OPEN for openRouter after 3 failures
🔄 Circuit breaker reset for openRouter (60s timeout passed)
```

## Logging & Monitoring

### AI Action Logs (MongoDB)
Every provider call is logged:
```javascript
{
  actionName: "AI_PROVIDER_OPENROUTER",
  input: { model: "openai/gpt-4o-mini", messageCount: 5 },
  output: { 
    success: true, 
    durationMs: 1240,
    stats: { ... }
  },
  projectId: "...",
  timestamp: "2024-01-01T12:00:00Z"
}
```

### Console Output
- 📡 = Attempting provider
- ✅ = Success
- ❌ = Failed attempt
- ⏳ = Retrying with backoff
- 🔴 = Circuit breaker opened
- 🔄 = Circuit breaker reset
- 🤖 = Starting operation
- 📬 = Response received

## API Functions

### `callAIWithFallback(params)`
Main fallback function called internally:
```javascript
const { response, provider } = await callAIWithFallback({
  model: 'placeholder', // Overridden by provider
  messages: [...],
  max_tokens: 1024,
  temperature: 0.7,
  tools: [...],
  context: { projectId, userId }
});

console.log(`Response from: ${provider}`); // 'openRouter' or 'openAI'
```

### `getProviderStats()`
Get current provider statistics:
```javascript
const stats = getProviderStats();
console.log(stats);
// {
//   openRouter: { successCount, failureCount, avgMs },
//   openAI: { successCount, failureCount, avgMs }
// }
```

## Error Handling

### Retryable Errors
- ✅ 429 (Rate Limit)
- ✅ ETIMEDOUT (Timeout)
- ✅ ECONNREFUSED (Connection refused)

### Non-Retryable Errors
- ❌ 401 (Authentication failed)
- ❌ 403 (Forbidden)
- ❌ 404 (Not found)

## Performance Implications

### Latency
- **OpenRouter success**: ~1000-1500ms
- **OpenAI fallback**: ~800-1200ms
- **Fallback delay** (if OpenRouter fails): +4-8 seconds (retry backoff)

### Cost
- **OpenRouter**: ~25% cheaper than direct OpenAI
- **Fallback to OpenAI**: Only triggered on failures (rare)
- **Estimated monthly**: $50-100 depending on usage

## Troubleshooting

### All Providers Failing
```
❌ AI: All providers exhausted. Last error: Connection refused
Provider stats: {openRouter: {failures: 3}, openAI: {failures: 3}}
```

**Solution**: 
- ✅ Check API keys are valid
- ✅ Check internet connectivity
- ✅ Verify OpenRouter/OpenAI APIs are accessible
- ✅ Monitor circuit breaker - wait 60 seconds

### Circuit Breaker Stuck Open
```
❌ AI: No providers available (all circuit breakers open)
```

**Solution**:
- ✅ Wait 60 seconds for automatic reset
- ✅ Check provider status pages
- ✅ Restart the server (clears circuit breaker state)

### One Provider Consistently Failing
Check logs for patterns:
```
🔴 Circuit breaker OPEN for openRouter after 3 failures
📡 AI: Attempting openAI (attempt 1/3)
✅ AI: openAI succeeded in 890ms
```

**This is normal** - system is working as designed. OpenAI is serving requests until OpenRouter recovers.

## Future Improvements

- [ ] Persistent circuit breaker state (Redis)
- [ ] Weighted provider selection based on performance
- [ ] A/B testing between providers
- [ ] Cost tracking and optimization
- [ ] Prometheus metrics export
- [ ] Real-time provider health monitoring dashboard
