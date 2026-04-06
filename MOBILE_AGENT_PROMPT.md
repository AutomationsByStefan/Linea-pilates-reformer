# COMPREHENSIVE PROMPT FOR MOBILE AGENT
# Copy everything below this line and paste it as your task to the Mobile Agent

---

Napravi Expo (React Native) mobilnu aplikaciju za Pilates Reformer studio "Linea Pilates". Aplikacija se povezuje na POSTOJECI backend API i treba da izgleda IDENTICNO kao web verzija. Samo klijentski ekrani - BEZ admin panela.

## BACKEND API
Base URL: `https://pilates-studio-19.preview.emergentagent.com/api`
Autentifikacija: Session cookies (credentials: 'include' na svakom fetch pozivu)

## DIZAJN SISTEM (OBAVEZNO POŠTOVATI)

### Boje
- Background: `#FDFCF8` (topla krem/bone boja)
- Primary/Gold: `#A68B5B` (glavni akcent - dugmad, aktivni elementi)
- Primary hover: `#8B7349`
- Gold gradient: `linear-gradient(135deg, #C4A574 0%, #A68B5B 100%)` - koristi se za hero kartice, aktivne datume, badge-eve
- Foreground (tekst): `#2C2C2C`
- Muted text: `#888888`
- Border: `rgba(229, 211, 179, 0.5)`
- Card background: `#FFFFFF`
- Secondary: `#F5E6D3`
- Input border: `#E8E2D8`

### Fontovi
- Naslovi (h1-h6): **Playfair Display** (serif) - elegantni naslovi
- Body tekst: **Manrope** (sans-serif) - čist, moderan

### Kartice (.card-linea)
- Background: white
- Border: 1px solid rgba(229, 211, 179, 0.5)
- Border radius: 24px (1.5rem)
- Shadow: 0 4px 20px -2px rgba(166, 139, 91, 0.1)
- Padding: 24px (1.5rem)

### Dugmad
- Primary (.btn-primary): bg #A68B5B, text white, full rounded (pill shape), height 48px
- Secondary: bg #F5E6D3, text #3E3E3E, pill shape
- Outline: transparent bg, border 2px solid #A68B5B

### Animacije
- fadeIn: opacity 0→1, translateY 10→0, 0.5s
- slideUp: opacity 0→1, translateY 20→0, 0.5s
- Staggered delays: 100ms, 200ms, 300ms, 400ms, 500ms

## SVI TEKST NA BOSANSKOM JEZIKU

## EKRANI I FUNKCIONALNOSTI

### 1. LOGIN EKRAN (/login)
- Logo na vrhu: slika sa URL-a `https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png` (sa mix-blend-multiply da bude transparentan na krem pozadini)
- Ispod loga tekst: "Dobrodosli" (Playfair Display, xl) i "Unesite broj telefona za prijavu" (siva, sm)
- Polje za telefon u jednom redu:
  - Lijevo: dropdown za pozivni broj sa zastavom. Default: 🇧🇦 +387. Dropdown otvara listu svih zemalja sa zastavama (emoji), imenima i kodovima. Ima search/filter polje na vrhu. Cca 150 zemalja.
  - Desno: input za telefonski broj, placeholder "61 234 567", sa Phone ikonom
- Dugme "Nastavi" (gold, full width, pill)
- Separator "ili" sa linijama
- Dugme "Prijavi se sa Google" - bijeli border, Google SVG ikona, tekst crn
- **API pozivi:**
  - `POST /api/auth/phone/check` body: `{phone: "+387..."}` → ako `exists: true`, idemo na PIN ekran; ako `false`, redirect na registraciju
  - Google login: redirect na `https://auth.emergentagent.com/?redirect={window.location.origin}/`

### 2. PIN EKRAN (dio Login ekrana, step 2)
- Naslov: "Zdravo, {ime}" (Playfair) + "Unesite vas 4-cifreni PIN" (siva)
- Input za PIN: password type, 4 cifre, numericki, centiran, tracking wide, sa Lock ikonom
- Dugme "Prijavi se" (gold)
- Link "Nazad" ispod
- **API:** `POST /api/auth/phone/login` body: `{phone, pin}` → vraca user objekat i setuje session cookie

### 3. REGISTRACIJA (/register)
- Logo (manji, h-20)
- "Kreirajte nalog" naslov + prikazan broj telefona
- Polja: Ime i Prezime (2 kolone), Email (opcionalno), PIN i Potvrdi PIN (2 kolone, 4 cifre numericki)
- Dugme "Kreiraj nalog" (gold)
- Separator "ili" + "Registruj se sa Google"
- Link "Nazad na prijavu"
- **API:** `POST /api/auth/register` body: `{phone, ime, prezime, email, pin}`

### 4. AUTH CALLBACK (za Google login)
- Detektuje `#session_id=...` u URL-u
- Salje `POST /api/auth/session` sa header `X-Session-ID: {sessionId}` i credentials include
- Redirect na home ako uspjesno

### 5. POČETNA (/) - Glavni ekran
- **Bottom navigacija**: 4 taba sa ikonama - Početna (Home), Termini (CalendarDays), Paketi (CreditCard), Profil (User). Aktivan tab ima gold boju (#A68B5B)
- Bottom nav: fixed bottom, white bg sa blur, border top gold, h-20, safe-area-inset-bottom padding

Sekcije (vertikalno skrolabilne):

**a) Welcome Hero kartica** (gold gradient pozadina, bijeli tekst)
- "Zdravo, {ime}" (Playfair, 2xl)
- "Vrijeme je da rezervišeš naredni trening?"
- Dugme "Rezerviši termin" (bijelo dugme, gold tekst, pill)
- Ikona zvonce gore desno sa brojacem neprocitanih notifikacija (ako ih ima)

**b) Aktivne članarine**
- Naslov "Aktivne članarine" sa "Vidi sve >" linkom desno
- Kartica clanarine: ime paketa, "Preostalo termina: X/Y" (gold brojevi), datum isteka desno
- Progress bar (gold gradient) koji pokazuje preostali procenat
- Ako nema clanarine: "Trenutno nemate aktivnih članarina" + dugme "Pogledaj pakete"
- Ako ima pending zahtjev za paket: "Vaš paket čeka aktivaciju nakon uplate"

**c) Predstojeći trening**
- Naslov sa "Vidi sve >" linkom (vodi na /treninzi)
- Kartica treninga: gold ikona kalendara (w-12 h-12, rounded-2xl, gradient-gold pozadina), datum (formatiran: "Ponedjeljak, 7. april"), vrijeme sa Clock ikonom
- Ako nema: "Trenutno nemate izabranih termina" + "Zakaži trening" dugme

**d) Kontakt informacije**
- Telefon kartica: Phone ikona u secondary bg kruzu + "+38766024148" (klikabilno, otvara dialer)
- Instagram kartica: Instagram SVG ikona + "@lineapilatesreformer" (otvara Instagram)
- Adresa kartica: MapPin ikona + "Kralja Petra I Oslobodioca 55, 89101 Trebinje" + embedded Google Maps (iframe ili MapView, read-only)

**e) Feedback modal** (iskace automatski 2s nakon ucitavanja ako ima pending feedback)
- "Kako ti je prijao trening?" naslov
- Info: datum + vrijeme treninga
- 3 kategorije ocjene (emoji: 😔 😐 🙂 😊 🤩):
  - "Fizičko stanje"
  - "Kvalitet treninga"
  - "Osjećaj napretka"
- Dugme "Pošalji"
- **API:** `POST /api/feedback` body: `{training_id, fizicko_stanje, kvalitet_treninga, osjecaj_napretka}` (1-5)

**API pozivi za Home:**
- `GET /api/memberships/active` - aktivne clanarine
- `GET /api/trainings/upcoming` - predstojeci treninzi
- `GET /api/studio-info` - info o studiju
- `GET /api/feedback/pending` - pending feedback treninzi
- `GET /api/notifications/unread` - neprocitane notifikacije
- `GET /api/user/activity-status` - status aktivnosti (inactivity reminder)
- `GET /api/packages/my-requests` - zahtjevi za pakete

### 6. TERMINI (/termini) - Raspored
**a) Horizontalni date strip**
- Naslov "Termini" (Playfair, 2xl) + "Odaberite datum za prikaz termina" (siva, sm)
- Horizontalni scrollable strip (drag-to-scroll) sa 10 radnih dana (PRESKOCI NEDJELJE)
- Svaki datum: dugme 56x68px, rounded-2xl
  - Gore: skraceni dan (PON, UTO, SRI, CET, PET, SUB) - uppercase, 10px
  - Dole: broj datuma sa tackom (6., 7., 8.) - 18px bold
  - Danas: prvi u nizu, suptilna pozadina (primary/10, border primary/30)
  - Selektovani: gold gradient pozadina, bijeli tekst, shadow
  - Ostali: bijeli bg, border, hover efekat

**b) Time slots ispod date strip-a**
- Podijeljeni u 2 grupe sa labelom:
  - "PRIJEPODNE" (uppercase, 10px, centered, siva)
  - "POSLIJEPODNE" (uppercase, 10px, centered, siva)
- Grid: 4 kolone
- Svaki slot: rounded-xl, padding 6px
  - Vrijeme (14px bold): 08:00, 09:00, 10:00, 11:00, 17:00, 18:00, 19:00, 20:00
  - Slobodna mjesta (10px, gold): "3/3"
  - Dugme "Rezervisi" (10px, gold gradient) ili "Puno" (sivo, disabled)
- Za danas: filtrira prosle termine (po trenutnom satu)
- Ako je korisnik vec zakazao za taj dan: prikazuje info karticu "Vas termin za ovaj dan: {vrijeme}" sa dugmetom "Promijeni" (ako je <30min od zakazivanja)

**c) Dijalozi (modalni)**
- Potvrda termina: "Potvrda termina" naslov, datum i vrijeme centtirano, "Da li potvrdujete dolazak?" + 2 dugmeta (Ne/Da)
- Share: "Termin rezervisan!" + dugme "Podijeli termin s prijateljicom" (SAMO ako ima jos slobodnih mjesta!) + "Preskoci"
- Promjena termina: info o trenutnom terminu + objasnjenje 30min pravilo + dugme

**Besplatni probni trening:** Ako korisnik nema paket i nikad nije zakazao trening, prvi booking je besplatan (backend vraca `is_trial: true`). Prikazi poruku "Cestitamo! Izabrali ste svoj besplatni probni trening!" (5s duration toast). Drugi pokusaj bez paketa vraca gresku.

**API pozivi:**
- `GET /api/schedule` - svi slotovi (vraca: id, datum, vrijeme, instruktor, ukupno_mjesta, slobodna_mjesta)
- `POST /api/bookings` body: `{slot_id, datum, vrijeme, instruktor}` → vraca {success, training_id, is_trial?, message}
- `GET /api/trainings/upcoming` - za provjeru postojeceg bookinga
- `POST /api/bookings/{training_id}/reschedule` body: `{new_slot_id, new_datum, new_vrijeme, new_instruktor}`
- `POST /api/trainings/share` body: `{training_id, generate_link: true}` → vraca {share_link}

### 7. PAKETI (/paketi)
- Naslov "Paketi" + "Odaberite paket koji vam odgovara"
- Ako ima pending request: banner "Vaš paket čeka aktivaciju nakon uplate" + ime paketa
- Lista paketa (kartice):
  - Ime paketa (Playfair, lg), opis "Mala grupa do 3 osobe"
  - Cijena desno (2xl bold) + "KM"
  - "X termina / mjesec" sa check ikonom
  - Dugme "Odaberi" (pill) - gold za popularne, secondary za ostale
  - "Najpopularniji" badge (primary bg) na Linea Gold (12 termina, 175 KM) - ring-2 ring-primary
  - "Najisplativiji" badge (#A68B5B bg) na Linea Premium (16 termina, 200 KM) - ring-2 ring-[#A68B5B]
  - Disabled "Na čekanju" ako vec ima pending request
- Potvrda: modal sa imenom, cijenom, brojem termina + "Nakon potvrde, vaš paket će čekati aktivaciju od strane studija nakon uplate."

**Paketi (6 komada):**
1. Pojedinacni - 25 KM - 1 termin
2. Basic - 90 KM - 6 termina
3. Linea Active - 125 KM - 8 termina
4. Linea Balance - 145 KM - 10 termina
5. Linea Gold - 175 KM - 12 termina (Najpopularniji)
6. Linea Premium - 200 KM - 16 termina (Najisplativiji)

**API:**
- `GET /api/packages`
- `GET /api/packages/my-requests`
- `POST /api/packages/request` body: `{package_id}`

### 8. PROFIL (/profil)
**a) Header** - centrirano
- Avatar krug (w-24, h-24, secondary bg, User ikona ili Google slika)
- Ime (Playfair, 2xl)
- Email ili telefon (siva, sm)

**b) Status članarine kartica**
- "Status članarine" naslov
- TrendingUp ikona + "Preostalo termina: X/Y" (gold veliki broj)
- Progress bar (gold gradient)
- Clock ikona + "Termini važe 30 dana"
- Calendar ikona + "Važe do: DD.MM.YYYY."
- Calendar ikona + "Početak: DD.MM.YYYY."

**c) Statistika** (2 kolone grid)
- Kartica 1: broj (Playfair, 3xl, gold) + "Treninga"
- Kartica 2: broj (Playfair, 3xl, gold) + "Sedmica"

**d) Informacije kartica**
- Email (sa Mail ikonom)
- Telefon (sa Phone ikonom)
- "Član od" datum (sa Calendar ikonom)

**e) Menu stavke** (navigacione kartice sa ChevronRight)
- "Praćenje težine" (Scale ikona) → /tezina
- "Obavještenja" (Bell ikona) → /obavjestenja
- "Postavke" (Settings ikona) → toast "Uskoro dostupno"

**f) Dugme "Odjavi se"** (outline destructive, pill, full width)

**g) Footer** "Linea Reformer Pilates v1.1.0" (xs, centered, siva)

**API:** `GET /api/user/stats` → {preostali_termini, ukupni_termini, zavrseni_treninzi, sedmice_aktivnosti, trajanje_dana, datum_isteka, datum_pocetka}

### 9. TVOJI TRENINZI (/treninzi) - Sub-ekran
- Back dugme + naslov "Tvoji treninzi"
- Tabs (2): "Predstojeci" | "Iskoristeni" (pill tabs, active = gold bg + white text)

**Predstojeci tab:**
- Kartica: gold Calendar ikona (w-12, h-12, gradient bg) + datum formatiran + vrijeme sa Clock ikonom + "Instruktor: Marija Trisic"

**Iskoristeni tab:**
- Kartica: Check ikona (muted bg) + datum + vrijeme + "Instruktor: Marija Trisic"
- Badge "Iskoristen" (primary/10 bg, primary text, pill, xs)
- Prikaz komentara (ako postoji): sivi box sa "Tvoj komentar:" label
- Dugme "Dodaj komentar" ili "Izmijeni komentar" (MessageSquare ikona, xs, primary boja)
- Textarea za komentar: "Kako si se osjecao/la na treningu?" placeholder, rounded-xl
- Dugmad: "Otkazi" ghost + "Sacuvaj" primary sa Send ikonom

**API:**
- `GET /api/trainings/upcoming`
- `GET /api/trainings/past`
- `POST /api/trainings/comment` body: `{training_id, komentar}`

### 10. PRAĆENJE TEŽINE (/tezina) - Sub-ekran
- Back + "Praćenje težine" naslov (sticky header sa blur)
- Info: "Ova funkcija je opcionalna. Pratite svoj napredak ako želite."
- Dodaj unos: input (number, step 0.1, placeholder "Težina", "kg" suffix) + Plus dugme (gold)
- SVG linijski grafikon (ako >1 unos): zadnjih 10 unosa, gold linija (#B8860B), tackice sa labelem, grid linije
- Trend summary: "Smanjenje od X.X kg" (zeleno, TrendingDown) ili "Povećanje" (narandzasto, TrendingUp) ili "Bez promjene"
- Historija lista: datum + težina (Playfair, xl) + kg + trend ikona + Trash dugme (destructive)

**API:**
- `GET /api/weight`
- `POST /api/weight` body: `{weight}`
- `DELETE /api/weight/{entry_id}`

### 11. OBAVJEŠTENJA (/obavjestenja) - Sub-ekran
- Back + "Obavještenja" naslov + "Označi sve" link (ako ima neprocitanih)
- Lista notifikacija:
  - Nepročitane: border-l-4 border-l-primary, bold naslov, primary ikona bg
  - Pročitane: normalan stil, muted ikona bg
  - Ikona (Bell/Calendar/Check zavisno od tipa), naslov, poruka, "Prije X min/h/dana"
- Click na neprocitanu → oznaci kao procitanu
- Prazno stanje: Bell ikona + "Nema obavještenja"

**API:**
- `GET /api/notifications`
- `GET /api/notifications/unread`
- `POST /api/notifications/{id}/read`
- `POST /api/notifications/read-all`

### 12. SVE ČLANARINE (/clanarine) - Sub-ekran
- Back + "Tvoje članarine" naslov
- Sekcija "Aktivne članarine": kartice sa imenom, "Preostalo: X/Y termina", "Aktivna" zeleni badge, datum isteka, progress bar
- Sekcija "Prethodne članarine": kartice sa opacity-70, "Iskorišteno: X/Y termina", "Istekla" sivi badge

**API:** `GET /api/memberships` (vraca aktivne i prethodne)

### 13. POZIVNICA (/pozivnica/:inviteId) - Deeplink ekran
- Logo + "Poziv na trening" naslov
- Info: "{ime} te poziva na zajednički Pilates Reformer trening"
- Detalji: datum, vrijeme, instruktor (Calendar, Clock, User ikone)
- Dugme "Prihvati poziv" (gold, h-14, text-lg)
- Napomena: "Potrebna je aktivna članarina za prihvatanje poziva"

**API:**
- `GET /api/invites/{inviteId}`
- `POST /api/trainings/invites/{inviteId}/accept`

## STUDIO PODACI (hardkodirani u studiju, dolaze iz API-ja)
- Naziv: "Linea Reformer Pilates"
- Telefon: +38766024148
- Instagram: @lineapilatesreformer
- Adresa: Kralja Petra I Oslobodioca 55, 89101 Trebinje
- Jedini instruktor: Marija Trisic
- Neradni dan: Nedjelja
- Termini: 08:00, 09:00, 10:00, 11:00, 17:00, 18:00, 19:00, 20:00
- Max po terminu: 3 osobe

## TEHNIČKE NAPOMENE
1. Svi API pozivi koriste session cookies → `credentials: 'include'` na svakom fetchu
2. Auth provjera: `GET /api/auth/me` (vraca user objekat ili 401)
3. Logout: `POST /api/auth/logout`
4. Formatiranje datuma na bosanskom: Ponedjeljak, Utorak, Srijeda, Cetvrtak, Petak, Subota (NIKAD Nedjelja jer je neradni dan)
5. Mjeseci: januar, februar, mart, april, maj, juni, juli, august, septembar, oktobar, novembar, decembar
6. Logo URL: https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png
7. Aplikacija koristi max-width 428px na webu (mobile container), na native-u je full width

## NE PRAVITI
- Admin panel (koristi se preko web browsera)
- Backend (vec postoji i radi)
- Bazu podataka (vec postoji)
