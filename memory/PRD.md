# Linea Reformer Pilates - PRD

## Original Problem Statement
Build a mobile-first web application for a Pilates Reformer Studio called "Linea Reformer Pilates" in **Bosnian language**. The app should have:
- Authentication with phone number and Google OAuth
- Bottom navigation with 4 tabs: Početna, Termini, Paketi, Profil
- Home page with welcome card, active memberships, upcoming trainings, contact info
- Schedule page for booking training sessions
- Packages page with membership options
- Profile page with user info and logout

## User Choices
- Real Google OAuth integration (Emergent-managed)
- Static map for Trebinje, Bosnia and Herzegovina location
- Gold/bronze color scheme based on provided logo
- Placeholder contact data (to be updated later)

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn/UI components
- **Backend**: FastAPI with MongoDB
- **Authentication**: Emergent Auth (Google OAuth) + Mock phone auth
- **Design**: Mobile-first (max-width 428px), card-based UI

## User Personas
1. **Primary**: Women interested in Pilates, wellness-focused, premium service seekers
2. **Location**: Trebinje, Bosnia and Herzegovina

## Core Requirements
- All UI text in Bosnian language
- Mobile-first responsive design
- Touch-friendly buttons (min 44px height)
- Bottom navigation always visible
- Clean, minimalist, elegant aesthetic

---

## What's Been Implemented

### January 2026 - MVP Complete

**Authentication Flow:**
- [x] Login page with phone input and Google OAuth
- [x] OTP verification (mock - code: 123456)
- [x] Registration page with all required fields
- [x] Google OAuth via Emergent Auth
- [x] Session management with cookies

**Main Pages:**
- [x] Početna (Home) - Welcome card, memberships, trainings, contact info
- [x] Termini (Schedule) - Week calendar, time slots, booking
- [x] Paketi (Packages) - 4 membership packages with pricing
- [x] Profil (Profile) - User info, stats, logout

**Additional Pages:**
- [x] Uslovi korištenja (Terms of Service)
- [x] Politika privatnosti (Privacy Policy)
- [x] Tvoje članarine (All Memberships)
- [x] Tvoji treninzi (All Trainings)

**Backend APIs:**
- [x] Phone auth: /api/auth/phone/send-otp, /api/auth/phone/verify
- [x] Google OAuth: /api/auth/session
- [x] User: /api/auth/me, /api/auth/logout, /api/auth/register
- [x] Memberships: /api/memberships, /api/memberships/active
- [x] Trainings: /api/trainings, /api/trainings/upcoming, /api/trainings/past
- [x] Schedule: /api/schedule
- [x] Packages: /api/packages
- [x] Studio Info: /api/studio-info

**Design:**
- [x] Gold/bronze color palette from logo
- [x] Playfair Display (headings) + Manrope (body) fonts
- [x] Card-based UI with soft shadows
- [x] Fixed bottom navigation
- [x] Animations and transitions

---

## Prioritized Backlog

### P0 - Critical (Next Phase)
- [ ] Payment integration (Stripe/local payment)
- [ ] Real SMS OTP integration
- [ ] Actual booking system with database
- [ ] Admin panel for managing schedule

### P1 - High Priority
- [ ] Push notifications for reminders
- [ ] Cancel booking functionality
- [ ] Booking confirmation emails
- [ ] Class capacity management

### P2 - Medium Priority
- [ ] Multiple class types (Mat, Private)
- [ ] Instructor profiles
- [ ] Reviews and ratings
- [ ] Referral program

### P3 - Nice to Have
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Progressive Web App (PWA)
- [ ] Social sharing

---

## Next Tasks
1. Integrate real payment processing for packages
2. Replace mock OTP with actual SMS service
3. Build admin dashboard for managing schedule and users
4. Add booking confirmation and cancellation flow
5. Implement real-time slot availability

---

## Contact Information (Placeholder)
- **Phone**: +387 59 123 456
- **Instagram**: @linea.pilates.trebinje
- **Address**: Trg Slobode 15, 89101 Trebinje

*Update these values in /app/backend/server.py under /api/studio-info endpoint*
