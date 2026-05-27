# ADR-004: State Management Choice

**Date:** 2024-01-25
**Status:** Accepted
**Deciders:** Engineering Team

## Context

We need to choose a state management solution for the React frontend.

## Decision

We will use **Zustand** for global state with **TanStack Query** for server state.

## Rationale

### Zustand Benefits
- Minimal boilerplate
- TypeScript-friendly
- Small bundle size (~1kb)
- React-free core

### TanStack Query Benefits
- Built-in caching
- Automatic refetching
- Optimistic updates
- Background sync

## Architecture

```
┌─────────────────────────────────────┐
│           React Components           │
└─────────────┬───────────────────────┘
              │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌────────────┐
│  Zustand │  │TanStack    │
│ (UI/Auth)│  │ Query      │
└──────────┘  │(Server)   │
              └────────────┘
```

## State Split

### Zustand Stores
- authStore: User authentication state
- uiStore: UI state (modals, drawers)
- bookingStore: Current booking flow

### TanStack Query
- All API data fetching
- Caching and invalidation
- Optimistic updates

## Consequences

### Positive
- Simple API (Zustand)
- Powerful caching (Query)
- Small bundle size
- TypeScript native

### Negative
- Two systems to learn
- Query can be complex for mutations
- Need to decide which store for each state
