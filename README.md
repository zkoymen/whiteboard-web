# Collaborative Whiteboard MVP

While I was teaching my friend English online using Google Meet and other platforms, I've noticed that extensions are poorly managed and feel so insufficient. So, I have decided to come-up with this MVP of collaborative whiteboard.
The main drawing functionalities were taken from tldraw library, no need to reinvent the wheel. And authorization anc access management is arranged with the help of cookies. Initially, PostgreSQL was used, but the fallback db errors was too much to handle. In the future, Supabase may be integrated.

Deployment options are being considered for now...

<img width="70%" alt="image" src="https://github.com/user-attachments/assets/391287de-6761-4593-aef0-9e72b346431e" />

----------after sign-up and the creation of the whiteboard----------------------

<img width="50%" alt="127 0 0 1_3000_b_0674ec14-8a19-4cbd-b13b-9337325ed5af (1)" src="https://github.com/user-attachments/assets/79abeda3-6ca0-4fe5-aea0-38622bb77c95" />


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
