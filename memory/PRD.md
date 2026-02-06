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

### February 2026 - Feature Extension

**New Features Added:**

1. **Push Notifications (In-App)** ✅
   - Day-before reminder notification
   - Same-day reminder (3 hours before)
   - Inactivity reminder (after 7 days without booking)
   - Friendly, warm Bosnian language tone

2. **Share Training Feature** ✅
   - "Podijeli termin s prijateljicom" button after booking
   - Shareable link generation for WhatsApp/Viber
   - In-app invite acceptance with capacity check
   - Invite page at /pozivnica/:id

3. **Post-Training Feedback** ✅
   - Emoji-based ratings (😔 😐 🙂 😊 🤩)
   - Three categories: Fizičko stanje, Kvalitet treninga, Osjećaj napretka
   - One-tap selection, no text required
   - Auto-popup after completed trainings

4. **Weight Tracking** ✅
   - Optional feature at /tezina
   - Input field with date
   - Simple line chart for progress
   - Non-intrusive, user-friendly

5. **Improved Scheduling UX** ✅
   - Horizontal scrollable calendar (14 days)
   - Date selection filters classes
   - Cards show: Time, Instructor, Available spots (e.g., 2/3)
   - Max 3 people per class (changed from 6)

6. **Profile Improvements** ✅
   - Remaining classes display (e.g., 7/12)
   - Validity info: "Termini važe 30 dana"
   - Expiration date: "Važe do: DD.MM.YYYY."
   - Membership start date in full format

7. **Updated Package Text** ✅
   - Changed from "Mala grupa do 6 osoba" to "Mala grupa do 3 osobe"

8. **Notifications Page** ✅
   - View all notifications at /obavjestenja
   - Mark as read functionality
   - Unread badge on home page

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
- [x] Praćenje težine (Weight Tracking)
- [x] Obavještenja (Notifications)
- [x] Pozivnica (Invite acceptance)

**Backend APIs:**
- [x] Phone auth: /api/auth/phone/send-otp, /api/auth/phone/verify
- [x] Google OAuth: /api/auth/session
- [x] User: /api/auth/me, /api/auth/logout, /api/auth/register
- [x] Memberships: /api/memberships, /api/memberships/active
- [x] Trainings: /api/trainings, /api/trainings/upcoming, /api/trainings/past
- [x] Bookings: /api/bookings
- [x] Sharing: /api/trainings/share, /api/trainings/invites/:id/accept
- [x] Feedback: /api/feedback, /api/feedback/pending
- [x] Weight: /api/weight (GET, POST, DELETE)
- [x] Notifications: /api/notifications, /api/notifications/unread
- [x] Stats: /api/user/stats, /api/user/activity-status
- [x] Schedule: /api/schedule
- [x] Packages: /api/packages
- [x] Studio Info: /api/studio-info

---

## MOCK APIs Notice
- **Phone OTP**: Always accepts code `123456`
- **Schedule**: Generated mock data for 14 days
- **Push Notifications**: In-app only, no real push service

---

## Prioritized Backlog

### P0 - Critical (Next Phase)
- [ ] Payment integration (Stripe/local payment)
- [ ] Real SMS OTP integration (Twilio/local provider)
- [ ] Real push notification service (Firebase Cloud Messaging)
- [ ] Admin panel for managing schedule

### P1 - High Priority
- [ ] Cancel booking functionality
- [ ] Booking confirmation emails
- [ ] Class waitlist when full
- [ ] Instructor availability management

### P2 - Medium Priority
- [ ] Multiple class types (Mat, Private sessions)
- [ ] Instructor profiles with photos
- [ ] Reviews and ratings for instructors
- [ ] Referral program with rewards

### P3 - Nice to Have
- [ ] Multi-language support (English, Serbian)
- [ ] Dark mode
- [ ] Progressive Web App (PWA)
- [ ] Social media sharing of achievements

---

## Notification Message Templates (Bosnian)

**Day-before reminder:**
```
Sutra te očekuje tvoj Pilates Reformer trening 💪
Vidimo se u {vrijeme}. Radujemo se zajedničkom treningu.
```

**Same-day reminder (3h before):**
```
Još malo do tvog treninga 🧘‍♀️
Početak u {vrijeme}. Vrijeme za pokret i dobar osjećaj.
```

**Feedback request:**
```
Odvoji trenutak za sebe 😊
Kako ti je prijao današnji Pilates Reformer trening?
```

**Inactivity reminder (7 days):**
```
Nedostaješ nam u studiju 😊
Vrijeme je da rezervišeš novi Pilates Reformer trening.
```

**Training invite:**
```
Tvoja prijateljica te poziva na zajednički Pilates Reformer trening 💪
Termin: {datum} u {vrijeme}
```

**Class full message:**
```
Nažalost, ovaj termin je upravo popunjen 😕
Molimo te da odabereš drugi dostupni termin.
```

---

## Contact Information (Placeholder)
- **Phone**: +387 59 123 456
- **Instagram**: @linea.pilates.trebinje
- **Address**: Trg Slobode 15, 89101 Trebinje

*Update these values in /app/backend/server.py under /api/studio-info endpoint*

---

## Next Tasks
1. Integrate real payment processing for packages
2. Replace mock OTP with actual SMS service
3. Implement Firebase Cloud Messaging for push notifications
4. Build admin dashboard for managing schedule and users
5. Add booking cancellation with time restrictions
