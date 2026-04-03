# Linea Reformer Pilates - PRD

## Problem Statement
Mobile-first web application for a Pilates Reformer Studio (Linea Pilates) with role-based access control. Client-facing booking interface + comprehensive admin panel for studio management. All UI in Bosnian.

## Tech Stack
- **Frontend**: React, Tailwind CSS, ShadCN UI, react-router-dom
- **Backend**: FastAPI, Motor (async MongoDB), APScheduler
- **Database**: MongoDB (test_database)
- **Auth**: Phone/OTP (mocked) + Google OAuth (Emergent-managed)

## DB Collections
- `users`: user_id, phone, name, email, is_admin, status, notes, created_at
- `memberships`: id, user_id, naziv, package_id, tip, preostali_termini, ukupni_termini, cijena, datum_pocetka, datum_isteka, created_by
- `trainings`: id, user_id, datum, vrijeme, instruktor
- `schedule_slots`: id, datum, vrijeme, instruktor, ukupno_mjesta
- `packages`: id, naziv, opis, cijena, valuta, termini, trajanje_dana, popular, active (NEW)
- `package_requests`: id, user_id, package_id, status, approved_by, created_at
- `manual_income`: id, iznos, opis, kategorija, datum, added_by (NEW)
- `admin_reminders`: id, tekst, datum, zavrseno, added_by (NEW)
- `revenue_archive`: month, revenue, pkg_revenue, manual_revenue, count (NEW)
- `weight_entries`: id, user_id, datum, tezina
- `notifications`: id, user_id, type, title, message, read, created_at

## Completed Features

### Phase 1 - MVP (Completed)
- [x] Phone/OTP login + Google OAuth
- [x] Bottom navigation (Home, Schedule, Packages, Profile)
- [x] Full-month calendar schedule view
- [x] Weight tracking with chart
- [x] In-app notifications
- [x] Bosnian language throughout

### Phase 2 - Admin Panel (Completed)
- [x] Unified auth with is_admin flag
- [x] Admin Dashboard with stats, alerts, package requests
- [x] Admin Schedule management
- [x] Admin Users management (freeze, deduct, notes)
- [x] Admin Bookings management
- [x] Package request approval workflow

### Phase 3 - 12-Point Enhancement (Completed Apr 3, 2026)
- [x] Packages migrated from hardcoded to MongoDB `packages` collection
- [x] Admin CRUD for packages (create, update, soft-delete)
- [x] Manual income tracking (CRUD API + UI)
- [x] Studio reminders for admin (CRUD + toggle completed)
- [x] Custom memberships (admin creates directly, bypasses requests)
- [x] Monthly revenue archiving
- [x] `approved_by` field on package request approvals
- [x] User package history (collapsible in admin users page)
- [x] Client schedule limited to next 10 days
- [x] Instructor column removed from admin bookings
- [x] 12-month revenue bar chart in financial overview
- [x] Responsive admin panel with Tailwind breakpoints

## Pending / Future Tasks
- [ ] P1: Add second admin account (wife's phone number pending)
- [ ] P1: Twilio SMS integration (credentials pending)
- [ ] P2: Firebase push notifications
- [ ] P2: PWA support
- [ ] P2: Booking confirmation emails

## Known Issues
- Babel metadata plugin can crash with complex components (mitigated by splitting into smaller files)
- OTP is mocked (always accepts 123456)
