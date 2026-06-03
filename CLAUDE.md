# Page Audit & Auto-Fix Skill

## Description

Comprehensive audit of any page including frontend code, backend API, cross-page connections, and **automatic fix implementation for ALL issues** (critical, high, medium, and low priority).

**No need to prompt "fix all the things" - it fixes everything automatically!**

## Usage

```
/audit-page [image_path_or_url]
```

## Arguments

- `image_path_or_url`: Optional path to screenshot or URL of the page to audit

## What This Skill Does

### Phase 1: Discovery & Analysis (Parallel Agents)
Launches 4 parallel agents to comprehensively analyze:

1. **Frontend Agent** - React/TSX components, API calls, state management, error handling
2. **Backend Agent** - Controllers, routes, services, validation, security
3. **Connection Agent** - Socket events, auth middleware, data flow
4. **Data Integrity Agent** - Type mismatches, enum inconsistencies, field mappings

### Phase 2: Auto-Fix ALL Issues (Parallel by Priority)

**Critical Issues** → Fixed first with dedicated agents
**High Priority Issues** → Fixed with dedicated agents
**Medium Priority Issues** → Fixed with dedicated agents
**Low Priority Issues** → Fixed with dedicated agents

All fixes run in parallel, grouped by file for efficiency.

### Fix Categories

- Type mismatches (frontend ↔ backend)
- Missing validation (Joi, ObjectId)
- Security issues (IDOR, injection, auth)
- Performance issues (N+1 queries, pagination)
- Error handling (try-catch, fallbacks)
- Accessibility (ARIA, keyboard nav)
- Missing indexes (MongoDB)
- Socket events (real-time updates)
- Enum inconsistencies

## Output

1. **Audit Report** - All issues found with severity levels
2. **Fixed Files** - All issues automatically fixed
3. **Verification** - TypeScript compilation verified

## Example

```
/audit-page
```
Then paste screenshot or describe the page when prompted.

## Requirements

- Node.js project with TypeScript
- Frontend in `frontend/src/`
- Backend in `backend/src/`

## Notes

- Skips files in `.claude/worktrees/` unless explicitly needed
- **Fixes ALL severity levels automatically** (critical, high, medium, low)
- Prioritizes production-readiness (handles scale, error cases)
- Preserves existing code (minimize changes)
- TypeScript compilation verified after each fix
- Uses parallel agents for maximum efficiency
