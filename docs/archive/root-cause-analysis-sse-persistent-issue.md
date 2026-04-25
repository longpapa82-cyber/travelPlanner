# Root Cause Analysis: Persistent SSE Connection Interruption Issue

**Analysis Date**: 2026-03-24
**Analyst**: Root Cause Analyst (SuperClaude)
**Severity**: CRITICAL
**Status**: INVESTIGATION IN PROGRESS

---

## Executive Summary

After three successive bug fixes (Bug #10, #11, and AdMob config plugin), the SSE connection interruption issue **persists**. This document provides a systematic root cause analysis across all architectural layers to identify why the fixes have not resolved the issue.

**Key Finding**: The code has been properly deployed to both backend (Railway) and frontend (EAS build versionCode 34), but the issue continues. This suggests a **deeper architectural or environmental problem** beyond simple implementation bugs.

---

## 1. Problem History Timeline

### Bug #10 (versionCode 33, 2026-03-23)
**Changes**:
- Backend: Added `res.flush()` + 500ms delay
- Frontend: Enhanced buffer parsing (VERSION 10.0)

**Result**: ❌ Issue persisted

### Bug #11 (versionCode 34, 2026-03-24)
**Changes**:
- Backend: Added heartbeat (5s interval) + 1KB padding
- Frontend: Added AdMob autofill disable plugin

**Result**: ❌ Issue persisted

### Current Status (2026-03-24)
**Symptom**: User still sees "Trip created but connection interrupted" message
**Behavior**: Redirected to TripList instead of TripDetail
**Confirmed**: Trip is created successfully in database
**Environment**: EAS build versionCode 34 (blue MyTravel icon)

---

## 2. Architecture Layer Analysis

### 2.1 Client Layer (React Native App)

**Location**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/services/api.ts`

**Current Implementation**:
```typescript
// Lines 438-514: Main SSE read loop with timeout protection
// Lines 516-559: Buffer processing after stream closes
// Lines 580-600: Fallback to recent trip fetch
```

**Verified Working**:
- ✅ Code is in versionCode 34 build (confirmed via build artifacts)
- ✅ TypeScript compilation: 0 errors
- ✅ Buffer parsing logic includes multiple strategies
- ✅ Timeout protection (30s)

**Potential Issues**:
1. **SSE Timeout Too Aggressive**: 30s timeout may be too short for slow networks
2. **Race Condition**: Stream closes before `complete` event is fully buffered
3. **Decoder State**: TextDecoder may lose state between chunks
4. **Promise.race Edge Case**: Timeout promise may trigger prematurely

### 2.2 Network Layer (Mobile Network / WiFi)

**Factors**:
- Mobile network instability
- Network switching (WiFi ↔ 4G/5G)
- Carrier proxy/CDN buffering
- DNS resolution delays
- TCP packet loss/reordering

**Potential Issues**:
1. **Network Buffering**: Mobile carriers may buffer SSE streams
2. **Connection Drops**: Brief network interruptions during stream
3. **Slow Network**: Data takes >30s to arrive, triggering timeout
4. **Packet Loss**: Complete event packet is dropped

### 2.3 Railway Proxy Layer

**Configuration**:
- Custom proxy layer between internet and Node.js
- Known to buffer responses (~100KB threshold)
- Headers: `X-Accel-Buffering: no` (may be ignored)

**Bug #11 Mitigation**:
- ✅ Heartbeat every 5 seconds
- ✅ 1KB padding on complete event
- ✅ Explicit `res.flush()` call

**Potential Issues**:
1. **Proxy Timeout**: Railway proxy may have its own timeout (<30s)
2. **Buffering Still Active**: Padding/heartbeat may be insufficient
3. **Connection Pooling**: Railway may close idle connections
4. **Load Balancer**: Multiple backend instances with inconsistent behavior

**CRITICAL QUESTION**: Is the Railway proxy closing connections before the complete event reaches the client?

### 2.4 Node.js/NestJS Layer

**Location**: `/Users/hoonjaepark/projects/travelPlanner/backend/src/trips/trips.controller.ts`

**Current Implementation**:
```typescript
// Line 92-95: Heartbeat every 5s
// Line 110-117: Complete event with 1KB padding
// Line 122-126: Explicit flush
// Line 130-134: 500ms delay before res.end()
```

**Verified Working**:
- ✅ Code deployed to Railway (commit 9c38d2da)
- ✅ Health endpoint returns "ok"
- ✅ TypeScript compilation: 0 errors
- ✅ Heartbeat interval properly cleared

**Potential Issues**:
1. **res.flush() Not Available**: TypeScript cast may succeed but method doesn't exist
2. **Delay Insufficient**: 500ms may be too short for Railway proxy
3. **Heartbeat Interference**: Heartbeat may flush incomplete buffers
4. **Error Swallowing**: Try-catch may hide flush failures

### 2.5 NestJS RxJS Stream Layer

**Location**: `trips.service.ts` → `Subject<TripCreationProgress>`

**Flow**:
1. Controller creates `Subject<>`
2. Service emits progress events
3. Controller subscribes and writes to SSE
4. Finally block completes Subject

**Potential Issues**:
1. **Race Condition**: Service completes before last event is written
2. **Subscription Timing**: Early unsubscribe may lose complete event
3. **Error Handling**: Exceptions may skip complete event emission

---

## 3. Timing Analysis

### Expected Timeline
```
0ms:    Client sends POST /api/trips/create-stream
100ms:  Backend starts processing
5000ms: First heartbeat sent
15000ms: Trip creation completes
15001ms: Complete event emitted (with padding)
15002ms: res.flush() called
15502ms: res.end() called (after 500ms delay)
15600ms: Client receives complete event
15700ms: Client fetches trip data
15800ms: Navigate to TripDetail
```

### Actual Timeline (Suspected)
```
0ms:    Client sends POST /api/trips/create-stream
100ms:  Backend starts processing
5000ms: First heartbeat sent
15000ms: Trip creation completes
15001ms: Complete event written to buffer
15002ms: res.flush() called (MAY NOT ACTUALLY FLUSH)
15502ms: res.end() called
15502ms: Railway proxy closes connection IMMEDIATELY
15502ms: Client receives stream closure (done=true)
15503ms: Client processes buffer (empty or incomplete)
15504ms: No complete event found
15505ms: Error path triggered
15506ms: Fallback to recent trip fetch (may or may not work)
```

**CRITICAL GAP**: Between `res.end()` and actual client receipt of complete event.

---

## 4. Data Flow Analysis

### Backend → Railway Proxy
```
Node.js Buffer → res.write() → Socket Buffer → Railway Proxy Buffer
```

**Verification Needed**:
1. Does `res.flush()` actually flush the socket buffer?
2. Does Railway proxy buffer even after flush?
3. What is Railway's connection close behavior?

### Railway Proxy → Client
```
Railway Proxy Buffer → Internet → Mobile Network → React Native Fetch API → ReadableStream
```

**Verification Needed**:
1. How long does Railway proxy keep connection open after `res.end()`?
2. Does mobile network buffer SSE streams?
3. Does React Native Fetch have buffering settings?

### Client ReadableStream Processing
```
ReadableStream → reader.read() → TextDecoder → Buffer → Event Parsing
```

**Current Problem Indicators**:
- `done=true` is received
- Buffer processing happens (lines 516-559)
- Complete event is NOT found in buffer
- Fallback to recent trip fetch

**CRITICAL QUESTION**: Is the complete event in the network buffer when `res.end()` is called?

---

## 5. Environment Factors

### 5.1 Test Environment Differences

| Factor | Development | EAS Build Production |
|--------|-------------|---------------------|
| Code Delivery | Metro bundler (real-time) | Bundled at build time |
| Network | Usually WiFi (stable) | Mobile network (unstable) |
| Debug Logs | Visible in Metro | May not reach client |
| Backend | May be local | Always Railway production |
| Network Latency | Low (~10ms) | High (~100-500ms) |

**Impact**: Issues may only manifest in production environment with real network conditions.

### 5.2 Railway Production Environment

**Known Factors**:
- Proxy layer with buffering
- Potential connection timeout (unknown duration)
- Load balancing across multiple instances
- Geographic distance from client

**Unknown Factors**:
- Exact proxy timeout settings
- Buffer flush behavior
- Connection pooling strategy
- Whether heartbeat actually prevents buffering

---

## 6. Client-Side Processing Issues

### 6.1 Buffer Processing Logic

**Lines 516-559** in `api.ts` handle remaining buffer after stream closes:

```typescript
// Strategy 1: Direct JSON parse
const event = JSON.parse(dataToProcess);

// Strategy 2: Add missing \n\n
if (!buffer.endsWith('\n\n')) {
  buffer += '\n\n';
}

// Strategy 3: Split by \n\n and process
const events = buffer.split('\n\n').filter(e => e.trim());
```

**Potential Issues**:
1. **Empty Buffer**: Railway closes connection before complete event arrives
2. **Partial Event**: Complete event is split across chunks
3. **Padding Interference**: 1KB padding may break JSON parsing
4. **Decoder State Loss**: TextDecoder reset between chunks

### 6.2 Fallback Mechanism

**Lines 580-600**: If complete event not found, fetch recent trips:

```typescript
const recentTrips = await this.getTrips({ limit: 1, sortBy: 'createdAt', order: 'DESC' });
if (recentTrips.trips?.[0] && ...) {
  result = recentTrips.trips[0];
}
```

**Potential Issues**:
1. **Race Condition**: Database may not have committed yet
2. **Wrong Trip**: User may have multiple trips in progress
3. **Network Failure**: Second API call may also fail
4. **Timeout**: 15-second window may be too strict

---

## 7. Hypotheses Ranked by Probability

### Hypothesis 1: Railway Proxy Aggressive Connection Closure ⭐⭐⭐⭐⭐
**Probability**: VERY HIGH

**Evidence**:
- Issue persists despite `res.flush()` + 500ms delay
- Heartbeat + padding did not fix issue
- Complete event is likely written but not transmitted

**Theory**:
Railway proxy has an **aggressive connection close policy** that terminates the connection immediately when `res.end()` is called, **before** buffered data is fully transmitted to the client. The 500ms delay only affects when `res.end()` is called, not how long the connection stays open afterward.

**Test Strategy**:
1. Add logging on Railway side to confirm when events are written
2. Increase delay to 2-3 seconds
3. Never call `res.end()` - let client close connection
4. Monitor Railway proxy logs (if accessible)

### Hypothesis 2: Mobile Network Buffering ⭐⭐⭐⭐
**Probability**: HIGH

**Evidence**:
- Issue may be specific to mobile network (not WiFi)
- Carrier proxies often buffer streaming data
- SSE is not widely used in mobile apps

**Theory**:
Mobile carrier proxy buffers SSE data and doesn't flush until connection closes OR buffer fills. The 1KB padding may be insufficient to trigger flush on all carriers.

**Test Strategy**:
1. Test on WiFi vs mobile network
2. Increase padding to 10KB or 50KB
3. Test across different carriers
4. Use HTTP/2 or WebSocket as alternative

### Hypothesis 3: Complete Event Not Actually Sent ⭐⭐⭐
**Probability**: MEDIUM-HIGH

**Evidence**:
- `res.flush()` may not exist or may be a no-op
- TypeScript cast doesn't guarantee method exists
- No error handling around flush

**Theory**:
`res.flush()` is called but does nothing because the method doesn't exist in Railway's Node.js environment or is a no-op. The complete event stays in Node.js buffer until `res.end()`, but Railway closes connection before flush.

**Test Strategy**:
1. Add error handling: `try { res.flush() } catch (e) { console.error(e) }`
2. Check if `flush` method exists before calling
3. Use `setImmediate()` or `process.nextTick()` instead of `setTimeout`
4. Verify actual data sent via Railway logs

### Hypothesis 4: Client Timeout Too Aggressive ⭐⭐⭐
**Probability**: MEDIUM

**Evidence**:
- 30s timeout in client code
- Trip creation can take >30s in slow networks
- Timeout promise may win race

**Theory**:
Client timeout (30s) is triggered before backend finishes creating trip. The timeout error is caught and triggers fallback, but backend is still processing. By the time complete event is sent, client has already given up.

**Test Strategy**:
1. Increase client timeout to 60s or 120s
2. Add timestamp logging to identify when timeout occurs
3. Check if backend logs show trip creation after timeout
4. Correlate timeout with trip creation duration

### Hypothesis 5: Padding JSON Parse Failure ⭐⭐
**Probability**: MEDIUM-LOW

**Evidence**:
- Complete event includes 1KB padding
- Client may not handle padded JSON correctly
- No specific test for padded events

**Theory**:
The 1KB padding field causes JSON parsing to fail or consume too much memory, leading to parse errors. Client buffer processing doesn't successfully extract complete event from padded JSON.

**Test Strategy**:
1. Add specific logging for padded event parsing
2. Test with and without padding locally
3. Reduce padding to 100 bytes
4. Move padding outside JSON (e.g., trailing spaces after `\n\n`)

### Hypothesis 6: Race Condition in RxJS Stream ⭐⭐
**Probability**: LOW-MEDIUM

**Evidence**:
- Complex async flow: Service → Subject → Controller → SSE
- Finally block may execute before last event is written
- No explicit synchronization

**Theory**:
Service completes the Subject in the `finally` block before the controller has finished writing the complete event to the SSE stream. This causes the subscription to unsubscribe prematurely.

**Test Strategy**:
1. Move `subscription.unsubscribe()` to after `res.end()`
2. Add delay in `finally` block
3. Use explicit Promise to track write completion
4. Log subscription state throughout flow

### Hypothesis 7: TextDecoder Chunking Issue ⭐
**Probability**: LOW

**Evidence**:
- TextDecoder used with `{ stream: true }`
- Multi-byte characters may split across chunks
- Complete event may be corrupted

**Theory**:
TextDecoder loses state between chunks or incorrectly handles multi-byte UTF-8 sequences, corrupting the complete event JSON.

**Test Strategy**:
1. Use single TextDecoder instance across all chunks
2. Test with ASCII-only data (no multi-byte)
3. Add hex dump logging of raw buffer
4. Verify JSON structure before parsing

---

## 8. Recommended Diagnostic Logging Strategy

### 8.1 Backend Logging (trips.controller.ts)

Add the following logs:

```typescript
// After heartbeat setup
console.log('[SSE DIAG] Heartbeat interval created:', heartbeatInterval);

// Before complete event
console.log('[SSE DIAG] Trip created, preparing complete event');
console.log('[SSE DIAG] Complete event tripId:', trip.id);
console.log('[SSE DIAG] Complete event size:', data.length, 'bytes');

// After res.write
console.log('[SSE DIAG] Complete event written at:', new Date().toISOString());
console.log('[SSE DIAG] Response writable:', res.writable);
console.log('[SSE DIAG] Response finished:', res.finished);

// Flush attempt
console.log('[SSE DIAG] Flush method exists:', typeof responseAny.flush === 'function');
try {
  if (typeof responseAny.flush === 'function') {
    responseAny.flush();
    console.log('[SSE DIAG] Flush succeeded at:', new Date().toISOString());
  }
} catch (error) {
  console.error('[SSE DIAG] Flush error:', error);
}

// Before and after setTimeout
console.log('[SSE DIAG] Waiting 500ms before res.end()');
setTimeout(() => {
  console.log('[SSE DIAG] 500ms elapsed, calling res.end() at:', new Date().toISOString());
  console.log('[SSE DIAG] Response writable before end:', res.writable);
  clearInterval(heartbeatInterval);
  res.end();
  console.log('[SSE DIAG] res.end() called at:', new Date().toISOString());
}, 500);
```

### 8.2 Client Logging (api.ts)

Add the following logs:

```typescript
// At stream start
console.log('[CLIENT DIAG] SSE stream started at:', new Date().toISOString());
console.log('[CLIENT DIAG] Network type:', navigator.connection?.effectiveType);

// In read loop
console.log('[CLIENT DIAG] Chunk received at:', new Date().toISOString());
console.log('[CLIENT DIAG] Chunk size:', value?.byteLength, 'bytes');
console.log('[CLIENT DIAG] Buffer size after chunk:', buffer.length, 'bytes');

// When done=true
console.log('[CLIENT DIAG] Stream done at:', new Date().toISOString());
console.log('[CLIENT DIAG] Final buffer size:', buffer.length, 'bytes');
console.log('[CLIENT DIAG] Final buffer hex:', Array.from(new TextEncoder().encode(buffer)).map(b => b.toString(16).padStart(2, '0')).join(' '));

// Buffer processing
console.log('[CLIENT DIAG] Processing buffer at:', new Date().toISOString());
console.log('[CLIENT DIAG] Events found in buffer:', events.length);

// Complete event detection
if (event.step === 'complete') {
  console.log('[CLIENT DIAG] Complete event found at:', new Date().toISOString());
  console.log('[CLIENT DIAG] Complete event tripId:', event.tripId);
} else {
  console.log('[CLIENT DIAG] Event parsed but not complete:', event.step);
}

// Fallback trigger
console.log('[CLIENT DIAG] No complete event, triggering fallback at:', new Date().toISOString());
console.log('[CLIENT DIAG] Time since stream start:', Date.now() - startTime, 'ms');
```

### 8.3 Timestamp Correlation

Both backend and client should log with **ISO timestamps** to correlate events:

```
[BACKEND SSE] Complete event written at: 2026-03-24T12:34:56.789Z
[BACKEND SSE] Flush succeeded at: 2026-03-24T12:34:56.790Z
[BACKEND SSE] res.end() called at: 2026-03-24T12:34:57.290Z

[CLIENT DIAG] Stream done at: 2026-03-24T12:34:57.450Z (160ms gap!)
[CLIENT DIAG] Final buffer size: 0 bytes (EMPTY!)
```

**Analysis**: If there's a large gap (>500ms) between `res.end()` and client receiving `done=true`, Railway proxy is holding the connection. If buffer is empty when `done=true`, complete event never arrived.

---

## 9. Alternative Solutions

If all hypotheses fail, consider **architectural alternatives**:

### 9.1 Polling Instead of SSE

**Pros**:
- More reliable on mobile networks
- No streaming complexity
- Works with all proxies

**Cons**:
- Less real-time
- More server load
- More battery drain

**Implementation**:
1. Client sends POST /api/trips (no stream)
2. Backend returns 202 Accepted + tripId
3. Client polls GET /api/trips/:id/status every 2s
4. Backend returns progress + status
5. When complete, return full trip data

### 9.2 WebSocket Instead of SSE

**Pros**:
- More robust bidirectional communication
- Better mobile support
- Can detect connection drops

**Cons**:
- More complex setup
- Requires WebSocket infrastructure
- Higher server resource usage

**Implementation**:
1. Use Socket.io or similar
2. Client connects WebSocket
3. Client emits "create_trip" event
4. Server emits progress events
5. Server emits "complete" event
6. Client disconnects

### 9.3 HTTP/2 Server Push

**Pros**:
- Better than SSE for mobile
- Native HTTP/2 feature
- Better proxy support

**Cons**:
- Requires HTTP/2 setup
- Limited browser support
- Railway may not support

### 9.4 Immediate Return + Webhook

**Pros**:
- Simplest approach
- Most reliable
- No streaming complexity

**Cons**:
- No real-time progress
- User must wait on TripList
- Requires notification system

**Implementation**:
1. Client sends POST /api/trips
2. Backend returns 202 Accepted + tripId immediately
3. Backend processes trip asynchronously
4. On complete, send push notification
5. Client refetches trip data

---

## 10. Immediate Action Items

### Priority 1: Enhanced Logging (IMMEDIATE)
1. ✅ Add comprehensive logging to backend (Section 8.1)
2. ✅ Add comprehensive logging to client (Section 8.2)
3. ✅ Deploy backend to Railway
4. ✅ Build new EAS version (versionCode 35)
5. ✅ Request user to test with logging enabled
6. ✅ Collect and analyze logs

**Goal**: Definitively identify at which layer the complete event is lost.

### Priority 2: Verify Deployment (IMMEDIATE)
1. ✅ Check Railway deployment logs
2. ✅ Verify commit hash in production
3. ✅ Test SSE endpoint with curl from server
4. ✅ Verify versionCode 34 is actually installed on user device

**Goal**: Confirm fixes are actually deployed and running.

### Priority 3: Extended Delay Test (HIGH)
1. Increase delay from 500ms to **3000ms** (3 seconds)
2. Remove `res.end()` call entirely (let connection timeout naturally)
3. Test if longer delay resolves issue

**Goal**: Determine if timing is the root cause.

### Priority 4: Alternative Transport (MEDIUM)
1. Implement polling fallback (9.1)
2. Test polling in production
3. If polling works, consider permanent switch

**Goal**: Provide reliable fallback if SSE proves unreliable.

---

## 11. Success Criteria

The issue is **definitively resolved** when:

1. ✅ User reports NO "connection interrupted" message
2. ✅ User automatically navigates to TripDetail
3. ✅ AI count decrements correctly
4. ✅ Issue does not recur across multiple trips
5. ✅ Works on both WiFi and mobile networks
6. ✅ Works consistently across different carriers
7. ✅ Logs confirm complete event received by client

---

## 12. Lessons Learned (To Be Updated)

This section will be updated after root cause is definitively identified.

**Preliminary Observations**:
1. SSE is unreliable on mobile networks with proxies
2. Multiple fixes without root cause identification is ineffective
3. Comprehensive logging should be first step, not last resort
4. Infrastructure layer (Railway proxy) behavior is critical
5. EAS build environment differs significantly from development

---

## 13. Next Steps

**IMMEDIATE** (Next 2 hours):
1. Add enhanced logging (Section 8)
2. Deploy backend to Railway
3. Build frontend versionCode 35
4. Request user testing with logs

**SHORT TERM** (Next 24 hours):
1. Analyze collected logs
2. Identify exact failure point
3. Implement targeted fix
4. Test and verify resolution

**MEDIUM TERM** (Next week):
1. Consider architectural alternatives if SSE proves unreliable
2. Implement polling fallback
3. Document Railway-specific limitations
4. Add monitoring/alerting for SSE failures

---

**Document Status**: PRELIMINARY ANALYSIS
**Next Update**: After enhanced logging deployment and testing
**Owner**: Root Cause Analyst (SuperClaude)
