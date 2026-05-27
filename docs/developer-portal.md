# NILIN Developer Portal

## Quick Start
1. Clone repo
2. Copy .env.example → .env
3. docker-compose up -d
4. npm install && npm run dev

## API Documentation
See api.nilin.app/docs

## Architecture
- Monorepo with shared types
- Event-driven backend
- React + Capacitor frontend
- MongoDB + Redis + BullMQ

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB, Redis |
| Queue | BullMQ |
| Mobile | Capacitor |
| Deploy | Docker, Kubernetes |
