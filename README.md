# Collaborative Whiteboard MVP

A minimal multi-user whiteboard app focused on real-time collaboration, simple sharing, and fast local development.

## Features

- Email/password auth
- Board CRUD (create, rename, delete)
- Real-time collaboration on the same board
- Role-based access: `owner`, `editor`, `viewer`
- Share links with `view` and `edit` modes
- Read-only enforcement for viewers

## Tech Stack

- Next.js + TypeScript
- tldraw + `@tldraw/sync-core`
- Node.js realtime server (WebSocket)
- Modular monorepo (`apps/*`, `packages/*`)

## Quick Start

```bash
npm install
npm run dev
```

Then open:

- Web: `http://localhost:3000`
- Realtime: `http://localhost:4001`

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

## Project Structure

- `apps/web` - Next.js app (UI + API routes)
- `apps/realtime` - WebSocket sync server
- `packages/shared` - shared types/access rules/token helpers
- `packages/db` - MVP data layer
- `packages/auth` - auth/session helpers

## Notes

- Current MVP persistence is file-based for simple local debugging.
- Production-grade database/auth hardening is planned for later iterations.
