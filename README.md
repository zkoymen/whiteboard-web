# Collaborative Whiteboard MVP

Small monorepo for a collaborative whiteboard MVP.

Current priorities:

- the app must open and work locally
- core flows must stay easy to debug
- UI stays minimal
- test and typecheck should stay green

## Current Stack

- `Next.js` for the web app
- `TypeScript` across the repo
- `tldraw` for the whiteboard UI
- `@tldraw/sync-core` for realtime rooms
- a small local cookie auth layer
- a JSON file store for MVP persistence

## What Works Right Now

- `/` redirects to `/login` when there is no session
- email/password sign up
- email/password sign in
- session cookie handling on server routes
- `/boards` dashboard
- board create / rename / delete
- board page access checks
- owner / editor / viewer access rules
- share links with `view` and `edit`
- realtime websocket service on port `4001`

## Repo Layout

- `apps/web`
  - Next app
  - login page
  - boards page
  - board page
  - auth and board API routes
- `apps/realtime`
  - websocket sync server
  - room token verification
- `packages/shared`
  - shared access logic
  - room token signing and verification
- `packages/db`
  - JSON-backed data store
  - board, member, share-link, session helpers
- `packages/auth`
  - cookie session helpers
  - sign-in / sign-up helpers
- `packages/ui`
  - small shared UI primitives
- `tests`
  - unit and integration tests

## How It Works

### 1. Auth

- [index.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/packages/auth/src/index.ts)
- [route.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/app/api/auth/[...all]/route.ts)
- [session.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/lib/session.ts)

Flow:

1. The login form posts to `/api/auth/sign-up/email` or `/api/auth/sign-in/email`.
2. The auth package validates credentials and creates a session token.
3. The API route sets the `whiteboard_session` cookie.
4. Server pages call `getServerSession()` to resolve the current user.

### 2. Data Store

- [index.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/packages/db/src/index.ts)

Flow:

1. MVP data is stored in `data/app-state.json`.
2. The file contains users, sessions, boards, members, and share links.
3. Writes are serialized through a simple promise queue.

This is intentionally simple so local debugging is easy. It is not the final production storage model.

### 3. Boards

- [page.tsx](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/app/boards/page.tsx)
- [route.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/app/api/boards/route.ts)

Flow:

1. `/boards` requires a valid session.
2. The page loads boards for the current user.
3. Dashboard actions call `/api/boards` routes.

### 4. Board Access

- [index.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/packages/shared/src/index.ts)
- [page.tsx](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/app/b/[boardId]/page.tsx)

Flow:

1. The board page resolves access using ownership, membership, or a share link.
2. If access is valid, the page signs a room token.
3. The client connects to the realtime server using that token.

### 5. Realtime

- [server.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/realtime/src/server.ts)

Flow:

1. The realtime service listens on `http://localhost:4001`.
2. It verifies room tokens before joining a board room.
3. Viewer sessions are marked read-only.
4. Latest room snapshots are written back into the JSON store.

## Run Locally

### 1. Install

```bash
npm install
```

### 2. Start

```bash
npm run dev
```

This starts:

- web on `http://localhost:3000`
- realtime on `http://localhost:4001`

### 3. Try The App

1. Open `http://localhost:3000/login`
2. Create an account
3. Open `/boards`
4. Create a board
5. Open the board page

## Useful Commands

```bash
npm run typecheck
npm test
npm run build
```

## What I Changed In This Pass

1. Removed the unstable local DB fallback path that was crashing the Next runtime.
2. Replaced auth startup with a small direct cookie-session flow.
3. Switched the data layer to a JSON-backed local store for MVP stability.
4. Fixed tests to use the same data path.
5. Verified these local flows:
   - `/` returns redirect to `/login`
   - `/login` returns `200`
   - sign up returns `200` and sets a cookie
   - `/boards` loads with the session cookie
   - board creation returns `200`
   - board page returns `200`

## Read This First

Recommended order if you want to understand the code quickly:

1. [index.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/packages/shared/src/index.ts)
2. [index.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/packages/db/src/index.ts)
3. [index.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/packages/auth/src/index.ts)
4. [session.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/lib/session.ts)
5. [page.tsx](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/app/boards/page.tsx)
6. [page.tsx](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/web/app/b/[boardId]/page.tsx)
7. [server.ts](/c:/Users/zeyne/Desktop/sidess/whiteboard-web/apps/realtime/src/server.ts)

## Current Limits

- persistence is file-based, not Postgres
- Google sign-in is not wired in this local MVP pass
- invite flow only works for users already created in the app
- no org/workspace layer yet
- no comments, uploads, templates, or version history
