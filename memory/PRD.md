# Linea Reformer Pilates - PRD

## Original Problem Statement
Build a mobile-first web application for a Pilates Reformer Studio called "Linea Reformer Pilates" in **Bosnian language**. The app should have:
- Authentication with phone number and Google OAuth
- Bottom navigation with 4 tabs: Pocetna, Termini, Paketi, Profil
- Home page with welcome card, active memberships, upcoming trainings, contact info
- Schedule page for booking training sessions
- Packages page with membership options
- Profile page with user info and logout

## User Choices
- Real Google OAuth integration (Emergent-managed)
- Static map for Trebinje, Bosnia and Herzegovina location
- Warm beige/tan color scheme based on provided logo
- Placeholder contact data (to be updated later)
- Admin panel for studio management
- Booking cancellation: admin-only, 12+ hours before training

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn/UI components
- **Backend**: FastAPI with MongoDB
- **Authentication**: Emergent Auth (Google OAuth) + Mock phone auth (Twilio pending)
- **Design**: Mobile-first (max-width 428px), card-based UI
- **Admin Panel**: Dark theme, sidebar navigation, desktop-friendly

## User Personas
1. **Primary**: Women interested in Pilates, wellness-focused, premium service seekers
2. **Admin**: Studio owner/manager who manages schedule and bookings
3. **Location**: Trebinje, Bosnia and Herzegovina

## Core Requirements
- All UI text in Bosnian language
- Mobile-first responsive design
- Touch-friendly buttons (min 44px height)
- Bottom navigation always visible
- Clean, minimalist, elegant aesthetic

---

## What's Been Implemented

### March 2026 - Admin Panel, Notifications & Booking Improvements

**New Features Added:**

1. **Real Notification Scheduler** - DONE
   - APScheduler with AsyncIOScheduler
   - Day-before training reminder (runs every hour)
   - Inactivity reminder after 7 days (runs every 6 hours)
   - Notifications stored in MongoDB
   - Duplicate notification prevention

2. **Admin Panel** - DONE
   - Admin login at /admin/login (credentials: admin@linea.ba / admin123)
   - Dark theme with sidebar navigation
   - Dashboard with stats (users, memberships, trainings, bookings)
   - Recent users list
   - Schedule CRUD management (add, delete slots)
   - Bulk schedule generation (generate N days of slots)
   - Bookings list with search and status filter
   - Users list with search
   - Responsive design (mobile sidebar + desktop)

3. **Booking Cancellation** - DONE
   - Admin-only cancellation
   - 12+ hours rule enforced by backend
   - Membership slot restored on cancellation
   - User notification on cancellation
   - Cancellation reason (optional)

4. **Schedule from Database** - DONE
   - Schedule slots stored in MongoDB (was dynamically generated)
   - 240 slots seeded on first startup (30 days x 8 slots/day)
   - Real-time availability calculation (booked vs total)
   - Admin CRUD operations

5. **Logo Background Fix** - DONE
   - Applied mix-blend-multiply + explicit bg-[#FDFCF8] on login page

6. **Updated Studio Info** - DONE
   - Instagram: https://www.instagram.com/lineapilatesreformer/ (@lineapilatesreformer)
   - Address: Kralja Petra I Oslobodioca 55, 89101 Trebinje
   - Google Maps iframe embed showing real location

7. **Same-Day Scheduling** - DONE
   - Today is selectable in the calendar
   - Only future time slots for today are shown (past times filtered)

8. **One Booking Per Day Limit** - DONE
   - User can only book one training per day
   - Backend enforces the limit
   - Clear error messages in Bosnian

9. **Booking Confirmation Dialog** - DONE
   - Popup shows day/time details before booking
   - "Da li potvrdjujete dolazak?" with Da/Ne buttons
   - Booking only saved when user clicks "Da"

10. **Reschedule Within 30 Minutes** - DONE
    - Users can change their booking within 30 min of creation
    - "Promijeni" button visible during the 30 min window
    - Reschedule dialog with current booking details
    - Backend validates 30 min window from created_at timestamp

### February 2026 - Feature Extension

**Features Added:**
1. Push Notifications (In-App) - day-before, same-day, inactivity reminders
2. Share Training Feature - shareable links for WhatsApp/Viber
3. Post-Training Feedback - emoji-based ratings
4. Weight Tracking - line chart at /tezina
5. Improved Scheduling UX - full-month calendar, 8 slots/day, 3 spots/class
6. Profile Improvements - remaining classes, validity dates
7. Updated Package Text - "Mala grupa do 3 osobe"
8. Notifications Page at /obavjestenja

### January 2026 - MVP Complete

**Authentication Flow:**
- [x] Login page with phone input and Google OAuth
- [x] OTP verification (mock - code: 123456)
- [x] Registration page
- [x] Google OAuth via Emergent Auth
- [x] Session management with cookies

**Main Pages:**
- [x] Pocetna (Home) - Welcome card, memberships, trainings, contact info
- [x] Termini (Schedule) - Full month calendar, time slots, booking
- [x] Paketi (Packages) - 4 membership packages with pricing
- [x] Profil (Profile) - User info, stats, logout

---

## MOCK APIs Notice
- **Phone OTP**: Always accepts code `123456` (Twilio integration pending)
- **SMS**: No actual SMS sent
- **Push Notifications**: In-app only, no Firebase Cloud Messaging

---

## Prioritized Backlog

### P0 - Critical (Next)
- [ ] Twilio SMS OTP integration (user installing Twilio)
- [ ] Payment integration (Stripe/local payment) for packages

### P1 - High Priority
- [ ] Firebase Cloud Messaging for push notifications
- [ ] Cancel booking from user side (with admin approval?)
- [ ] Booking confirmation emails
- [ ] Instructor availability management

### P2 - Medium Priority
- [ ] Multiple class types (Mat, Private sessions)
- [ ] Instructor profiles with photos
- [ ] Reviews and ratings for instructors
- [ ] Referral program with rewards
- [ ] PWA support (installable app)

### P3 - Nice to Have
- [ ] Multi-language support (English, Serbian)
- [ ] Dark mode for user app
- [ ] Social media sharing of achievements

---

## Admin Credentials
- **Email**: admin@linea.ba
- **Password**: admin123
- **URL**: /admin/login

## Contact Information
- **Phone**: +387 59 123 456
- **Instagram**: @lineapilatesreformer (https://www.instagram.com/lineapilatesreformer/)
- **Address**: Kralja Petra I Oslobodioca 55, 89101 Trebinje

---

## Key API Endpoints

### User APIs
- POST /api/auth/phone/send-otp, /api/auth/phone/verify
- POST /api/auth/session (Google OAuth)
- GET /api/auth/me, POST /api/auth/logout, POST /api/auth/register
- GET /api/memberships, /api/memberships/active
- GET /api/trainings, /api/trainings/upcoming, /api/trainings/past
- POST /api/bookings
- POST /api/trainings/share
- POST /api/feedback
- GET/POST /api/weight
- GET /api/notifications
- GET /api/schedule, /api/packages, /api/studio-info
- GET /api/user/stats, /api/user/activity-status

### Admin APIs
- POST /api/admin/login, GET /api/admin/me, POST /api/admin/logout
- GET /api/admin/dashboard
- GET /api/admin/users
- GET /api/admin/schedule, POST /api/admin/schedule/slots
- PUT /api/admin/schedule/slots/{id}, DELETE /api/admin/schedule/slots/{id}
- POST /api/admin/schedule/generate-week
- GET /api/admin/bookings
- POST /api/admin/bookings/{id}/cancel
