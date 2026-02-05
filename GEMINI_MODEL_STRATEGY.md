# Gemini Model Selection & Fallback Strategy

## Overview
This document describes the robust Gemini model selection and fallback strategy implemented to eliminate 404 and 429 errors.

## Model Selection

### Primary Model: `gemini-2.0-flash-lite-001`
- **Why**: Fast, versatile, stable release from January 2025
- **Use Case**: Primary model for all WhatsApp and Vapi interactions
- **Token Limits**: 1M input, 8K output
- **Features**: Supports function calling, multimodal input

### Fallback Model: `gemini-2.0-flash-001`
- **Why**: Standard stable version, widely available
- **Use Case**: Automatic fallback when primary model fails or hits rate limits
- **Token Limits**: 1M input, 8K output
- **Features**: Same capabilities as primary model

## Detection Process

Models were detected by querying the Generative Language API:
```bash
curl https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY
```

**Available Models Confirmed**:
- ✅ `gemini-2.0-flash-lite-001` (Primary)
- ✅ `gemini-2.0-flash-001` (Fallback)
- ✅ `gemini-2.5-flash` (Latest, but may have availability issues)
- ✅ `gemini-pro-latest` (Stable, but slower)
- ❌ `gemini-1.5-flash-001` (Not available with current API key)
- ❌ `gemini-1.5-flash-*` variants (Not available)

## Implementation

### Core Utility: `lib/gemini.ts`

**Exports**:
- `genAI`: GoogleGenerativeAI instance (for embeddings)
- `PRIMARY_MODEL_ID`: "gemini-2.0-flash-lite-001"
- `FALLBACK_MODEL_ID`: "gemini-2.0-flash-001"
- `callGemini()`: Single-turn helper with fallback
- `RobustChat`: Multi-turn chat session with fallback

**Retry Logic**:
1. Try PRIMARY_MODEL_ID
2. If 429 (rate limit), wait 2s and retry PRIMARY_MODEL_ID
3. If still fails, switch to FALLBACK_MODEL_ID
4. If both fail, throw `GEMINI_TOTAL_FAILURE`

### Updated Files

1. **`netlify/functions/whatsapp.ts`**
   - Uses `RobustChat` for multi-turn conversations
   - Maintains chat history across stateless function calls
   - Graceful error handling with user-friendly messages
   - Try-catch wraps entire conversation flow

2. **`netlify/functions/vapi-llm.ts`**
   - Uses `RobustChat` for Vapi LLM interactions
   - Handles tool calling with fallback support
   - Maintains conversation history for voice calls

3. **`netlify/functions/vapi.ts`**
   - Uses `callGemini()` for single-turn RAG queries
   - Simplified model initialization
   - Automatic fallback for tool execution

## Error Handling

### WhatsApp Handler
```typescript
try {
  const result = await chat.sendMessage(promptContent);
  // ... process result
} catch (error: any) {
  if (error.message === "GEMINI_TOTAL_FAILURE") {
    responseText = "Our AI assistant is currently at capacity or undergoing maintenance. A human agent will jump in to help you shortly! Thank you for your patience.";
  } else {
    responseText = "I'm having a bit of trouble processing that. Can you try again in a moment?";
  }
}
```

### Graceful Degradation
- **404 Errors**: Automatically switch to fallback model
- **429 Errors**: Retry with backoff, then fallback
- **Total Failure**: User-friendly message, human handoff

## Logging

All model decisions and errors are logged:
```
[GEMINI] Using primary model: gemini-2.0-flash-lite-001
[GEMINI] Primary model 429, retrying with backoff...
[GEMINI] Falling back to model: gemini-2.0-flash-001
[GEMINI] Fatal error in conversation flow: GEMINI_TOTAL_FAILURE
```

## Benefits

1. **Eliminates 404 Errors**: Only uses confirmed available models
2. **Handles Rate Limits**: Automatic retry and fallback for 429s
3. **User Experience**: Graceful error messages instead of crashes
4. **Consistency**: Centralized model selection across all functions
5. **Maintainability**: Single source of truth for model IDs
6. **Observability**: Comprehensive logging for debugging

## Future Improvements

- Monitor model performance metrics
- Add circuit breaker pattern for persistent failures
- Implement model selection based on request complexity
- Add support for streaming responses with fallback
- Consider adding `gemini-2.5-flash` as tertiary fallback

## Verification

To verify the implementation:
1. Send a WhatsApp message to trigger the flow
2. Check Netlify function logs for model selection
3. Confirm no 404 or unhandled 429 errors
4. Test graceful failure message by simulating API outage

---

**Last Updated**: 2026-02-05  
**Helper Function**: `callGemini`, `RobustChat` (in `lib/gemini.ts`)  
**Primary Model**: `gemini-2.0-flash-lite-001`  
**Fallback Model**: `gemini-2.0-flash-001`
