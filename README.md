# Collaborative Team Hub

A full-stack web application for teams to manage shared goals, post announcements, and track action items in real time.

## 🚀 Live URLs
- **Frontend URL:** [https://jijanur-team-hub.up.railway.app/](https://jijanur-team-hub.up.railway.app/)
- **Backend API URL:** [https://collaborative-team-hub-production.up.railway.app/](https://collaborative-team-hub-production.up.railway.app/)

## 👥 Demo Accounts
Seeded accounts you can use to test immediately (all share the same password):
- **Admin**: `jijanur@gmail.com` / `jijan1234`
- **Member**: `saiful@demo.com` / `jijan1234`
- **Member**: `rabby@demo.com` / `jijan1234`

## 🛠 Built With
- **Monorepo**: Turborepo
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Zustand, Recharts
- **Backend**: Node.js, Express.js, Prisma ORM, Socket.io, Cloudinary
- **Database**: PostgreSQL
- **Deployment**: Railway

## ✨ Advanced Features Implemented (Chosen 2)

As per the technical assessment requirements, I have implemented two specific advanced features:

1. **Advanced RBAC (#4)**
   - Roles: `ADMIN`, `MEMBER`, and `VIEWER`.
   - Comprehensive permission matrix on the backend implemented as a custom middleware (`requirePermission`).
   - Admins can manage workspace settings, invite/remove members, update roles, and manage announcements.
   - Members can create/edit goals, action items, and comments.
   - UI conditionally renders actions based on role (e.g. Settings tab is hidden for non-admins, action status dropdowns disabled for viewers).

2. **Audit Log (#5)**
   - Immutable log of all workspace changes.
   - Dedicated filterable timeline UI in the dashboard.
   - Tracks entity creations (Goals, Action Items, Announcements), role changes, and member joins/leaves.
   - Complete CSV Export feature to download the entire timeline history for compliance.

## 🎁 Extra Features Built
- Full **Dark Mode / Light Mode** support (detects system preference).
- **Email Notifications** via Nodemailer for mentions and invites.
- **Optimistic UI** & **Real-time Synchronization** (via Socket.io).

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
# Enter the API directory
cd apps/api

# Push schema to database
npx prisma db push

# Seed the database with demo data (Note: This wipes old data and resets demo accounts)
node prisma/seed.js
```

### 5. Running the App
From the root directory:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000` and backend API at `http://localhost:4000`.

## ⚠️ Known Limitations
- Rich text image uploads within the TipTap editor are not implemented (attachments go directly on the post instead).
- Email delivery relies on valid SMTP credentials. If Nodemailer fails to connect to Google SMTP, the app catches it silently without breaking the flow, but emails won't arrive.
- When opening two accounts on the same browser window, the browser's shared cookie jar will conflict. Use Chrome Incognito Mode or a separate browser to test real-time collaboration between two different users simultaneously.
