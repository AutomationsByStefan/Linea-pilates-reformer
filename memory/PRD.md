# Linea Reformer Pilates - PRD

## Problem Statement
Mobile-first web application for a Pilates Reformer Studio (Linea Pilates) with role-based access control. Client-facing booking interface + comprehensive admin panel for studio management. All UI in Bosnian.

## Tech Stack
- **Frontend**: React, Tailwind CSS, ShadCN UI, react-router-dom
- **Backend**: FastAPI, Motor (async MongoDB), APScheduler
- **Database**: MongoDB (test_database)
- **Auth**: Phone + 4-digit PIN (hashed with bcrypt), Google OAuth (Emergent-managed)

## Admin Accounts
- **Linea Trebinje**: +38766024148, PIN: 2803 (primary)
- **Stefan**: +381640080404, PIN: 1234
- **Nevena**: +381652344415, PIN: 1234

## Studio Rules
- **Sole instructor**: Marija Trisic
- **Non-working day**: Sunday (nedjelja)
- **Schedule times**: 08:00, 09:00, 10:00, 11:00, 17:00, 18:00, 19:00, 20:00
- **Max per class**: 3
- **Free trial**: First booking without package is free (one-time only)

## Packages (6 predefined)
1. Pojedinacni: 25 KM, 1 termin
2. Basic: 90 KM, 6 termina
3. Linea Active: 125 KM, 8 termina
4. Linea Balance: 145 KM, 10 termina
5. Linea Gold: 175 KM, 12 termina (Najpopularniji)
6. Linea Premium: 200 KM, 16 termina (Najisplativiji)

## Completed Features
- [x] Phone + PIN authentication
- [x] Google OAuth login (Emergent-managed)
- [x] Country code dropdown with flags (159 countries)
- [x] Logo on login and register pages
- [x] Admin Panel button for admin users
- [x] Admin "Moj profil" button to return to client app
- [x] Bottom navigation (Home, Schedule, Packages, Profile)
- [x] Horizontal scrollable date strip (10 working days, skip Sundays, drag-to-scroll)
- [x] 8 daily time slots (08:00-11:00, 17:00-20:00)
- [x] Only Marija Trisic as instructor
- [x] Sunday disabled as non-working day
- [x] Free trial training for new users (one-time, no package needed)
- [x] Past trainings marked as "Iskoristen" with private comments
- [x] 3 admin accounts (Linea Trebinje, Stefan, Nevena)
- [x] Admin bookings: only upcoming (no past)
- [x] Admin schedule: only today + 10 days
- [x] Weight tracking with chart
- [x] In-app notifications with APScheduler
- [x] Admin Dashboard, Users, Bookings, Schedule management
- [x] Packages from MongoDB with CRUD
- [x] Revenue archiving

## Pending / Future Tasks
- [ ] P1: Twilio SMS integration (credentials pending)
- [ ] P2: Firebase push notifications
- [ ] P2: PWA support
