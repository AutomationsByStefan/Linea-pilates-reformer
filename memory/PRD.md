# Linea Reformer Pilates - PRD

## Original Problem Statement
Build a mobile-first web application for a Pilates Reformer Studio called "Linea Reformer Pilates" in **Bosnian language**.

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn/UI components
- **Backend**: FastAPI with MongoDB
- **Auth**: Emergent Auth (Google OAuth) + Mock phone OTP
- **Design**: Mobile-first, card-based UI, warm beige theme for clients, dark theme for admin

## Contact Information
- **Phone**: +38766024148
- **Instagram**: @lineapilatesreformer
- **Address**: Kralja Petra I Oslobodioca 55, 89101 Trebinje

## Packages
| Naziv | Termini | Cijena |
|-------|---------|--------|
| Basic | 6 | 90 KM |
| Linea Active | 8 | 125 KM |
| Linea Balance | 10 | 145 KM |
| Linea Gold | 12 | 175 KM |
| Linea Premium | 16 | 200 KM |

## Admin Credentials
- **Legacy**: admin@linea.ba / admin123 (at /admin/login)
- **Phone admin**: +38766024148 (is_admin=true)

---

## Implemented Features

### Client Features
- Phone OTP login (mock - code always 123456)
- Google OAuth login (Emergent Auth)
- Home page: welcome, active memberships, upcoming training, contact info
- Schedule: full-month calendar, 8 slots/day, same-day booking, confirmation dialog
- Packages: 5 packages with request/approval workflow
- Profile: user info, stats, logout
- Weight tracking with line chart
- In-app notifications
- One booking per day limit
- Reschedule within 30 minutes
- Google Maps embedded for studio address
- No instructor names shown (per user request)
- Empty states: "Trenutno nemate aktivnih članarina" / "Trenutno nemate izabranih termina"

### Admin Features
- Unified auth (phone login) + legacy admin login
- Dashboard with stats, pending package requests, financial overview, expiry alerts
- Package request notifications with approve/reject
- Schedule CRUD (add, delete slots, bulk generate)
- Booking management with cancellation (12h+ rule)
- User management with: session deduction, package freeze/unfreeze, client notes, status management
- Financial overview: monthly revenue chart, revenue by package, client stats
- Expiry alerts: memberships expiring in 7 days, 2 or fewer sessions
- Phone country detection (RS/BA)

### Backend Features
- APScheduler for day-before and inactivity notifications
- Schedule slots stored in MongoDB
- Package request approval workflow
- Session deduction system
- Package freeze with expiry extension

---

## MOCK APIs
- Phone OTP: always 123456 (Twilio pending)
- SMS: not sent

## Prioritized Backlog
### P0
- [ ] Twilio SMS OTP integration

### P1
- [ ] Payment integration for packages
- [ ] Second admin account (wife's phone number needed)

### P2
- [ ] Firebase push notifications
- [ ] PWA support
- [ ] Booking confirmation emails
