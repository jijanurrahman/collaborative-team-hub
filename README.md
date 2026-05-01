# Collaborative Team Hub

A full-stack web application for teams to manage shared goals, post announcements, and track action items in real time.

## 🚀 Built With
- **Monorepo**: Turborepo
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Zustand, Recharts, TipTap, DnD
- **Backend**: Node.js, Express.js, Prisma ORM, Socket.io, Cloudinary
- **Database**: PostgreSQL

## ✨ Advanced Features Implemented

As per the technical assessment requirements, I have implemented two advanced features:

1. **Optimistic UI (#2)**
   - When creating a Goal, Action Item, or Announcement, the UI immediately reflects the new item locally before the server confirmation arrives. If the server request fails, the UI rolls back gracefully and displays an error toast.
   - Kanban board dragging immediately updates the UI state, providing instantaneous feedback.
   - Empathizes responsiveness over network latency.

2. **Advanced RBAC (#4)**
   - Roles: `ADMIN`, `MEMBER`, and `VIEWER`.
   - Comprehensive permission matrix on the backend implemented as a custom middleware (`requirePermission`).
   - Admins can manage workspace settings, invite/remove members, update roles, and manage announcements.
   - Members can create/edit goals, action items, and comments.
   - Viewers can only comment and react.
   - UI conditionally renders actions based on role (e.g. Settings tab is hidden for non-admins, action status dropdowns disabled for viewers).

## 🎁 Extra Features Built
- Full **Dark Mode / Light Mode** support out-of-the-box (detects system preference).
- **Global Command Palette** (Press `Cmd+K` / `Ctrl+K`) for rapid navigation.
- **Collaborative Live Editing** for Goal Descriptions (shows live cursors and "Editing" badges).
- Full **Audit Log** track of all workspace actions, with CSV Export feature.
- **Email Notifications** via Nodemailer for mentions and invites.
- **OpenAPI Swagger Docs** served at `/api/docs`.

## ⚙️ Setup & Local Development

### 1. Prerequisites
- Node.js >= 18.0.0
- PostgreSQL database
- Cloudinary account (for avatars and attachments)

### 2. Environment Variables

Create an `.env` file in `apps/api/`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/teamhub
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLIENT_URL=http://localhost:3000
PORT=4000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@teamhub.app
```

Create an `.env.local` file in `apps/web/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. Installation
From the root of the project:
```bash
npm install
```

### 4. Database Setup & Seeding
```bash
# Push schema to database
npm run db:push

# Seed the database with demo data
npm run db:seed
```

### 5. Running the App
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000` and backend API at `http://localhost:4000`.

### 👥 Demo Accounts
Seeded accounts you can use to test immediately:
- `alice@demo.com` / `Demo1234!` (Admin)
- `bob@demo.com` / `Demo1234!` (Member)
- `carol@demo.com` / `Demo1234!` (Member)

## ☁️ Deployment on Railway

1. Create a new Railway project and provision a PostgreSQL database plugin.
2. Create two separate services within the project (one for the backend, one for frontend).
3. Set the Root Directory of the backend service to `apps/api`. Set its start command to `npm start`. Add all API `.env` variables there.
4. Set the Root Directory of the frontend service to `apps/web`. The build command will be `npm run build` and start command `npm start`. Add the API/Socket URL env vars to this service.
5. Deploy!

## ⚠️ Known Limitations
- Rich text image uploads within the TipTap editor are not implemented (attachments go directly on the post instead).
- Socket connection drops and reconnects might rarely cause duplicate visual updates until page refresh (though idempotent locally).
- Email delivery relies on valid SMTP credentials. If Nodemailer fails to connect to Google SMTP, the app catches it silently without breaking the flow, but emails won't arrive.
