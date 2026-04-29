# Linea Reformer Pilates - PRD

## Problem Statement
Mobile-first web application for Linea Pilates Reformer Studio with role-based access. Client-facing booking app + comprehensive admin panel. All UI in Bosnian.

## Tech Stack
- **Frontend**: React, Tailwind CSS, ShadCN UI, react-router-dom, Chart.js + react-chartjs-2
- **Backend**: FastAPI, Motor (async MongoDB), APScheduler, Expo Push Notifications
- **Database**: External production MongoDB (via MONGO_URL env)
- **Auth**: Phone + 4-digit PIN (bcrypt), Google OAuth (Emergent-managed)

## Admin Accounts
- **Linea Trebinje**: +38766024148, PIN: 2803 (primary)
- **Stefan**: +381640080404, PIN: 1234
- **Nevena**: +381652344415, PIN: 1234

## Studio Rules
- Sole instructor: Marija Trisic
- Non-working: Sunday + Saturday afternoons
- Times: 08:00–11:00, 17:00–20:00 (8 slots/day)
- Max per class: 3
- Bookings require active membership (no free trials)
- 35-day membership expiry counted from FIRST utilized training

## Completed Features
- [x] Phone+PIN + Google OAuth login (with logo, country flags)
- [x] Client app: Home, Schedule (drag-to-scroll date strip), Packages, Profile, Notifications, Weight tracking
- [x] Admin Panel — Kontrolna tabla (NEW dark theme + Chart.js)
- [x] Admin Panel — **Finansije** stranica (NEW): mjesečni grafici, donut po paketu, popularni dani/termini
- [x] Admin Panel — **Profil pojedinačnog klijenta** (NEW): historija članarina/zahtjeva, sve akcije
- [x] Modular chart components (StatCard, RevenueLineChart, PackageDoughnut, OccupancyBarChart, SectionCard)
- [x] Backend: real-time analytics, finance breakdown, freeze/unfreeze, base64 photos, refund logic
- [x] Expo Push Notifications integration
- [x] APScheduler daily reminder job (day-before + inactivity)
- [x] **APScheduler auto-renewal reminder** (3 days before expiry) — idempotent, logs to `renewal_reminders_log`

## Frontend Architecture (Admin)
```
/app/frontend/src/pages/admin/
├── AdminLayout.jsx              # Sidebar nav (incl. Finansije)
├── AdminDashboardPage.jsx       # Kontrolna tabla (charts-first)
├── AdminFinancePage.jsx         # NEW Finansije
├── AdminClientProfilePage.jsx   # NEW individual client profile
├── AdminUsersPage.jsx           # User list (linkuje na profil)
├── AdminUserDialogs.jsx         # Freeze/Notes/Custom dialogs
├── AdminSchedulePage.jsx
├── AdminBookingsPage.jsx
└── components/
    ├── StatCard.jsx
    ├── SectionCard.jsx
    ├── chartConfig.js
    ├── RevenueLineChart.jsx
    ├── PackageDoughnut.jsx
    ├── OccupancyBarChart.jsx
    ├── ClientProfileHeader.jsx
    ├── ClientMembershipDetail.jsx
    └── ClientHistoryLists.jsx
```

## Pending / Future Tasks
- [ ] **P1**: "Dodaj prošli trening" dugme unutar profila klijenta
- [ ] **P2**: Twilio SMS integration (kredencijali pending)
- [ ] **P2**: Firebase push notifications (alternativa Expo)
- [ ] **P2**: PWA support
