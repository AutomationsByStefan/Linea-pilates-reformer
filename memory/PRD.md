# Linea Reformer Pilates - PRD

## Problem Statement
Mobile-first web application for a Pilates Reformer Studio (Linea Pilates) with role-based access control. Client-facing booking interface + comprehensive admin panel for studio management. All UI in Bosnian.

## Tech Stack
- **Frontend**: React, Tailwind CSS, ShadCN UI, react-router-dom
- **Backend**: FastAPI, Motor (async MongoDB), APScheduler
- **Database**: MongoDB (test_database)
- **Auth**: Phone + 4-digit PIN (hashed with bcrypt), Google OAuth (Emergent-managed)

## DB Collections
- `users`: user_id, phone, name, email, is_admin, status, notes, pin_hash, created_at
- `memberships`: id, user_id, naziv, package_id, tip, preostali_termini, ukupni_termini, cijena, datum_pocetka, datum_isteka, created_by
- `trainings`: id, user_id, datum, vrijeme, instruktor
- `schedule_slots`: id, datum, vrijeme, instruktor, ukupno_mjesta (times: 08:00,09:00,10:00,11:00,17:00,18:00,19:00,20:00)
- `packages`: id, naziv, opis, cijena, valuta, termini, trajanje_dana, popular, best_value, active
- `package_requests`: id, user_id, package_id, status, approved_by, created_at
- `manual_income`: id, iznos, opis, kategorija, datum, added_by
- `admin_reminders`: id, tekst, datum, zavrseno, added_by
- `revenue_archive`: month, revenue, pkg_revenue, manual_revenue, count
- `weight_entries`: id, user_id, datum, tezina
- `notifications`: id, user_id, type, title, message, read, created_at

## Auth Flow
1. User enters phone (country code +387 default + number)
2. System checks if phone exists → if not, redirect to registration
3. If exists → prompt for 4-digit PIN
4. On registration, user sets 4-digit PIN (stored hashed as pin_hash)
5. Admin users (is_admin: true) see "Admin Panel" button on client app

## Packages (6 predefined)
1. Pojedinacni: 25 KM, 1 termin
2. Basic: 90 KM, 6 termina
3. Linea Active: 125 KM, 8 termina
4. Linea Balance: 145 KM, 10 termina
5. Linea Gold: 175 KM, 12 termina (Najpopularniji)
6. Linea Premium: 200 KM, 16 termina (Najisplativiji)

## Completed Features
- [x] Phone + PIN authentication (replaced OTP)
- [x] Country code dropdown (default +387 BiH)
- [x] Admin Panel button for admin users (visible on client app)
- [x] Bottom navigation (Home, Schedule, Packages, Profile)
- [x] Full-month calendar schedule with 10-day limit
- [x] 8 daily time slots (08:00-11:00, 17:00-20:00)
- [x] Instructor name hidden from client screens
- [x] Weight tracking with chart
- [x] In-app notifications with APScheduler
- [x] Admin Dashboard (stats, reminders, financial chart, manual income)
- [x] Admin Users (custom memberships, package history, freeze/unfreeze)
- [x] Admin Bookings (no instructor column)
- [x] Admin Schedule management
- [x] Packages from MongoDB with CRUD
- [x] Revenue archiving

## Pending / Future Tasks
- [ ] P1: Add second admin account (wife's phone number pending)
- [ ] P1: Twilio SMS integration (credentials pending)
- [ ] P2: Firebase push notifications
- [ ] P2: PWA support

## Known Issues
- Babel metadata plugin can crash with complex components (mitigated by splitting files)
- Admin PIN: 1234, Test user PIN: 1234
