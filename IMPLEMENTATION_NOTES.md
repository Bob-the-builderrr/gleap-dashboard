# Archived + Done Tickets Implementation

## Overview
The **Archived Tickets** view now combines both **Archived** and **Done** (closed) tickets to provide a complete picture of agent ticket-closing activity.

## Changes Made

### 1. New API Function: `fetchDoneTickets()`
- **Endpoint**: `https://dashapi.gleap.io/v3/tickets?type=INQUIRY&status=DONE`
- **Purpose**: Fetches tickets with `status=DONE` (closed but not archived)
- **Parameters**: Same dynamic limit logic as archived tickets (200/500/1000 based on time window)

### 2. Enhanced `processArchivedTickets()`
**Signature Changed**:
```javascript
// Before
processArchivedTickets(tickets, minutes, customStart, customEnd)

// After
processArchivedTickets(archivedTickets, doneTickets, minutes, customStart, customEnd)
```

**Functionality**:
- Processes **two separate arrays** of tickets
- **Archived tickets**: Uses `archivedAt` timestamp, agent from `processingUser`
- **Done tickets**: Uses `updatedAt` timestamp, agent from `latestComment`
- Adds `type` field to each ticket: `"Archived"` or `"Done"`
- Uses `timestamp` field for unified sorting
- Combines both ticket types per agent
- Updates `latestArchived` to the most recent timestamp (either archived or done)
- Counts both types in hourly matrix

### 3. Updated `fetchAndRenderArchived()`
- Now fetches **both endpoints in parallel** using `Promise.all()`
- Passes both arrays to `processArchivedTickets()`

### 4. Enhanced Modal Display
- Shows **ticket type badge** ("Archived" or "Done") for each ticket
- Sorted by timestamp (most recent first)
- Format: `Bug #296225 | Archived | 05:16:29 (IST)`

## Example Result

### Scenario:
- Time window: Last 1 hour
- Agent: Abigail
- Archived 1 ticket at 05:16:29
- Closed (Done) 1 ticket at 05:20:29

### Display:
**Agent Summary Table**:
```
Agent: Abigail
Count: 2
Latest Archived: 2023-11-24 05:20:29 (IST)  ← Most recent timestamp
```

**View Tickets Modal**:
```
Bug #296226  [Done]      05:20:29 (IST)
Bug #296225  [Archived]  05:16:29 (IST)
```

**Hourly Matrix**:
```
Hour 05: 2  ← Both tickets counted
```

## Technical Details

### Done Ticket Agent Extraction
```javascript
const user = ticket.latestComment || {};
const agentId = user.id || ticket.latestComment?.email || "unknown";
const agentName = user.firstName || user.email?.split("@")[0] || "Unknown";
```

### Timestamp Selection
- **Archived tickets**: `ticket.archivedAt`
- **Done tickets**: `ticket.updatedAt`

### Ticket Merging Logic
- Tickets are grouped by `agentId`
- All tickets (archived + done) are stored in `agent.ticketDetails[]`
- Latest timestamp determines `agent.latestArchived`
- Both types contribute to hourly matrix counts

## Files Modified
- `dashboard.js` - All logic changes

## Backwards Compatibility
✅ Fully backwards compatible - existing archived ticket functionality remains unchanged, done tickets are purely additive.
