# Reached — Product Spec

Reached tells your people you arrived safely, without you having to remember. The name matches how Ghanaians already text "I've reached," and it is neutral across all of Ghana's languages. Published by Osnw Tech Studio.

## 1. Overview

- **Launch market:** Ghana only. SMS through Africa's Talking; WhatsApp through the WhatsApp Cloud API (later); registered with Ghana's Data Protection Commission.
- **Core promise:** set it up once and it works on its own. Ways a notification happens, least to most effort:
  1. **Place rules** — "Whenever I arrive at Work, tell Mom." Always on, no trip needed.
  2. **Auto-detect** (Phase 2) — the app notices you left somewhere and stopped somewhere new, then sends "arrived safely in East Legon."
  3. **Heading-out prompt** (Phase 2) — the app notices you leaving and offers one-tap "Notify when I arrive."
  4. **Manual trip** — the user picks destination and contacts; also used for safety trips with an expected arrival time.
  5. **Contact request** (Phase 2) — a contact asks the app to tell them when you reach.
- **Contacts never need the app.** They get SMS (later WhatsApp) and, from Phase 2, a live-location web link.

| Phase | What ships |
| --- | --- |
| 1 — MVP | Phone sign-up, contacts, place rules, manual trips, arrival messages, overdue alerts, SOS (hold shield), activity, settings, web pages for privacy/terms/account deletion |
| 2 — Smart | Auto-detect, heading-out prompt, contact requests, trip details (plate photo), ride-hailing link/screenshot import, live link page, hands-free SOS triggers, local languages |
| 3 — Growth | Police station finder, police alert dashboard, premium and family plans, ride-app notification reading, partnerships, admin dashboard |

## 2. App map

Bottom tabs: **Home · Places · Contacts · Activity · Settings**. Onboarding runs on first launch only and ends on Home. From any screen: hold the SOS shield 3 seconds; the "Are you okay?" prompt appears when a trip is overdue.

## 3. Onboarding

1. **Splash** — logo 1–2 s. Logged in → Home; else → Welcome.
2. **Welcome (3 slides)** — "Never forget to say you've reached" · "Your people get a text, no app needed" · "If something's wrong, we raise the alarm." Buttons: Skip, Next, Get started (last slide) → Phone number.
3. **Phone number** — fixed +233 prefix, number field, note "By continuing you agree to the Terms and Privacy Policy" (links open in-app). **Send code** (disabled until valid) → sends OTP, opens Verify.
4. **Verify code** — 6 digit boxes; Android auto-reads SMS. **Resend code** after 60-second countdown. **Change number** → back. Correct → new user: Your name; returning: Home. Wrong → boxes shake, "That code isn't right."
5. **Your name** — first name (required, used in messages), optional photo. **Continue**.
6. **Who should know you're safe?** — **Choose from contacts** (explainer → contacts permission → picker) or **Enter number** (name, phone, relationship: Mom, Dad, Partner, Sibling, Friend, Other; reach by SMS/WhatsApp/both). **Save** → contact gets intro SMS. **Skip for now** → Home shows "Add someone to notify" card.
7. **Location explainer** — "Reached needs your location to know when you arrive. We never sell it, and trip locations are deleted after 30 days." **Allow location** → system prompt; then second explainer for "Allow all the time" with **Open settings** (Android 11+ can't ask directly). **Not now** → only manual trips work; Home banner explains.
8. **Notifications explainer** — "We'll check on you if you're running late." **Turn on** / **Not now** (Home banner).
9. **Keep Reached running (Android only)** — **Fix it** → remove battery restrictions, then brand-specific steps (Tecno, Infinix, itel, Samsung…). **Skip** → Home banner.
10. **Where's home?** — Use my current location · Search an address · Enter GhanaPost GPS address · Skip. After saving: "Tell [first contact] when you get home?" toggle (on). **Done** → Home.

## 4. Home screen

| Element | Shows | Tapping does |
| --- | --- | --- |
| Greeting + avatar | "Good morning, Ama" + photo | Avatar → Profile (Settings) |
| SOS shield (top right) | Shield icon | Hold 3 s → Emergency. Short tap shows "Hold to send SOS" |
| Warning banner (only when needed) | e.g. "Location is off, arrivals won't be detected" | **Fix** → right permission/settings screen |
| Status card | Normal: "You're covered · 3 places · 2 contacts". During a trip: Active trip card (map preview, destination, expected arrival, who will be told) | Normal → Places; trip → Active trip |
| **Start a trip** (main button) | — | → Start a trip |
| **Send "I've reached" now** | Secondary button | Sheet: default contacts ticked, message preview with current area name, **Send** |
| Quick places row | Chips: saved places + **+ Add** | Chip → Start a trip with that place chosen; + Add → Add place |
| Recent activity | Last 3 events, e.g. "Told Mom you reached Work · 8:42am" | Event → detail; **See all** → Activity |
| Contact request card (Phase 2) | "Mom wants to know when you reach" | Accept / Decline |
| Heading-out card (Phase 2) | "Looks like you're heading out" | Notify when I arrive / Not now |

## 5. Trips

### Start a trip
- **Where to?** search; below it saved places, recent destinations, **Pick on map** (draggable pin, Confirm), **GhanaPost GPS address** (e.g. GA-123-4567), **I'm not sure yet** (Phase 2: auto-detect; Phase 1: hide or require a destination).
- **Who to tell** — contact chips, defaults pre-selected; tap to remove, + to add.
- **Message** — preview "Ama has arrived safely at Work." **Edit** to change wording for this trip, per contact.
- **Tell them I'm leaving now** toggle (off) → sends "on the way" message.
- **Check on me if I'm late** toggle (on when a destination is set): expected arrival filled from map estimate, editable; grace period default 15 min (10/15/30/60). Without destination: 30 min · 1 hr · 2 hrs · Custom.
- **Add trip details** (Phase 2): transport (Trotro, Taxi, Ride-hailing, Own car, Walking, Motorbike), plate photo, driver name, or pull from a ride app. Only shared if something goes wrong.
- **Start trip** → Active trip.

### Active trip
- Map with position and destination zone circle; status "On the way · arriving around 6:30pm" and who will be told.
- **I've arrived** → sends now → Arrived screen.
- **Running late** → +15 min · +30 min · +1 hr · Custom; option "Tell them I'm running late".
- **Share live location** (Phase 2). **Edit trip** → Start a trip pre-filled.
- **Cancel trip** → **Cancel quietly** or **Cancel and tell them plans changed**.
- SOS shield stays in the corner.

### Arriving
- **Auto-send** (default): message goes out the moment arrival is detected; user notified "Told Mom you reached Work."
- **Ask me first**: notification "You've reached Work. Tell Mom?" **Send** / **Not now**; if ignored 5 min, sends anyway (configurable).
- **Arrived screen** — tick, "Mom has been told," per-contact status Sending → Sent → Delivered (SMS delivery reports). **Done** → Home.

### Ride-hailing trips (Phase 2+)
Uber, Bolt and Yango don't offer a public way to read a rider's trips. Methods: share the ride's trip-status link to Reached (Phase 2); screenshot the driver card, on-device text recognition fills plate/name/car, user confirms (Phase 2); read ride-app notifications with permission, Android only (Phase 3); official partnerships via a Reached API (Phase 3+).

## 6. Places and rules

- **Places tab** — list (icon, name, area, rules summary); **+ Add place**; Suggested places (Phase 2); tap → Place detail.
- **Add/edit place** — name quick picks (Home, Work, School, Church, Gym, Mom's house, custom), icon; location via current / search / map pin / GhanaPost GPS; **arrival zone** slider 100–500 m (default 150 m) drawn on map. **Save** → Place detail with prompt "Add a rule for this place?"
- **Place detail** — map + zone, name, address; rules with on/off switches; **+ Add rule**; **Edit place**; **Delete place** (confirm "Delete Work and its 2 rules?").
- **Rule screen** — When I: Arrive · Leave. Tell: contacts. On: Every day · Weekdays · Weekends · Pick days. At: Any time · Only between (times). Message: preview + Edit. **Save rule**; existing rule: **Delete rule** with confirm.
- Cap saved places at 15 (iOS monitors max 20 regions per app).

## 7. Contacts

- **List** — name, relationship, SMS/WhatsApp icons, star for default contacts. Badges only when needed: **Opted out** (replied STOP), **Message failed**. **+ Add contact**. Phase 2: People who share with you.
- **Contact detail** — name/number/relationship editable; Reach by SMS · WhatsApp · Both; message language (Phase 2); Default contact switch; Can ask where I am (Phase 2); **Send test message**; rules with this contact; **Remove contact** (confirm, removes from all rules).
- **Contact requests (Phase 2)** — contact replies REACHED to the Reached number/WhatsApp or taps a link. User gets notification + Home card; Accept → optional destination, watch for arrival; Decline → "Ama can't share right now"; no answer in 15 min → "Ama hasn't responded yet". Never track without the user's yes.

## 8. Emergency

The overdue check runs on the server, so it works even if the phone dies. Contacts are alerted only when the user asks for help or doesn't answer.

### Overdue flow
1. Expected arrival + grace period passes without arrival → **"Are you okay?"** push + full-screen screen, with sound where allowed.
2. Answers within 5 minutes:
   - **I'm okay** → "Have you arrived?" Yes sends normal arrival; Still on the way keeps trip going. No alert.
   - **Need more time** → +15 · +30 · +1 hr, back to watching.
   - **Get help** → alert emergency contacts immediately.
3. No answer in 5 min (countdown shown) → alert emergency contacts with last location + link.
4. **I'm safe now** (requires app PIN or phone unlock) → All clear message.

### SOS
- Hold shield 3 s → 5-second countdown with large **Cancel** → alert to emergency contacts with location link and trip details.
- After sending: who was alerted + delivery status, Ghana emergency numbers with tap-to-call, **I'm safe now**. Location shared every 30 s until I'm safe now.
- Phase 3 idea: duress PIN.

### Hands-free SOS (Phase 2+)
Discreet: one vibration, no sound, nothing on screen. Triggers: lock-screen SOS button on the ongoing trip notification (Android) / Live Activity (iPhone); voice ("Hey Siri, Reached SOS"; Google Assistant on Android, check support); power button pressed quickly 3 times on Android (not 5 — Android 12+ uses 5 for its own Emergency SOS); Action button or Back Tap shortcut on iPhone; smartwatch (Phase 3).

**Every alert includes:** name, number, time, live location link, battery level, trip details if any (destination, transport, plate photo, driver, ride link).

### Reaching the police
At launch Reached cannot message the police automatically (no public channel; apps can't place emergency calls by themselves). Alerts go to emergency contacts, whose message tells them to call the police if they can't reach the user; the SOS screen shows tap-to-call emergency numbers. Phase 3 with a police partnership: police alert dashboard (live SOS alerts with location, trip details, plate photo) or SMS to a police-chosen number; Settings switch **Also alert the police**; false-alarm protection (police see cancellations; cancel requires PIN/unlock).

## 9. Activity

- Filter chips: All · Arrivals · Alerts · Requests.
- List grouped by day; row: icon, what happened, who was told, time, delivery status (e.g. "Reached Work · Mom told · 8:42am · Delivered").
- **Event detail** — small map of detected arrival point, time, exact message; per-contact Sent/Delivered/Failed (+reason); **Resend** if failed; **This wasn't right** → I hadn't arrived yet · Wrong place · Shouldn't have sent (used to tune detection).
- Footer: "Activity is deleted automatically after 30 days." Empty state with **Start a trip**.

## 10. Settings

**Account** — Profile (name, photo, phone; Change number needs OTP; optional email). Plan (Phase 3; mobile money MTN MoMo, Telecel Cash, AT Money, and card).

**Arrivals** — How arrivals are sent: Send automatically / Ask me first (+ "If I don't answer, send after" 5 · 10 min · Never). Default message (editable, insert name/place/time, live preview). Late check grace period (10/15/30/60). Auto-detect (Phase 2). Heading-out prompts (Phase 2).

**Safety** — Emergency contacts (can differ from arrival contacts). SOS: hold length 3 s, countdown 5 · 10 s; Phase 2: hands-free triggers with setup guides. Emergency numbers with tap-to-call (confirm current numbers with police before launch). Nearest police station (Phase 3) + Also alert the police switch once partnership is live.

**Notifications** — Arrival confirmations (switch); Late check-ins (always on, greyed, "Needed to keep you safe"); Contact requests (switch); Tips and updates (off by default).

**Permissions and battery** — each row green tick or red warning with **Fix**: Location (needs "All the time"), Notifications, Battery (Android, brand steps), Contacts access. **Run a test** → simulates arrival and sends the message to the user only.

**Privacy and data** — Privacy Policy (in-app web page with last-updated date); Terms of Use; Who can see my location (plain-language explainer: only on arrival, live link, or emergency; links expire when trip ends); Keep my activity for 7 / 30 days (default 30); Delete my activity now (confirm); Download my data (builds a file, opens share sheet); Delete account (explains, requires OTP; required in-app by both stores, plus a web page for Google).

Privacy Policy must cover: data collected (phone, name, contacts added, location near saved places and during trips, device info), why, who it's shared with (SMS/WhatsApp providers, hosting, maps), retention, rights under Ghana's Data Protection Act, 2012 (Act 843), Data Protection Commission registration number, contact for data questions, minimum age.

**App and support** — Language (English; Twi, Ga, Ewe in Phase 2); Appearance Light · Dark · Match phone; Help and FAQ (incl. "Why didn't my arrival send?"); Chat with support (WhatsApp); Report a problem (asks to attach logs); Invite a friend; Rate Reached; About (version, licences); **Log out** (confirm: "Your place rules will stop working while you're logged out.").

## 11. Messages to contacts

Keep every SMS ≤160 characters; WhatsApp versions need approved templates.

| Message | When | Wording |
| --- | --- | --- |
| Intro | Contact first added | Hi, Ama added you as a safety contact on Reached. You'll get a text when Ama arrives safely. Reply STOP to opt out. |
| Arrived | Arrival detected/tapped | Ama has arrived safely at Work (8:42am). – Reached |
| On the way | "Tell them I'm leaving now" | Ama is on the way to Work, expected around 6:30pm. – Reached |
| Running late | Trip extended + tell | Ama is running late. New expected arrival: 7:00pm. – Reached |
| Plans changed | Trip cancelled + tell | Ama's trip to Work was cancelled. All is fine. – Reached |
| Overdue alert | No arrival, no response | ALERT: Ama hasn't arrived at Work (due 6:30pm) and isn't responding. Last seen 6:12pm: [link]. Please call Ama. |
| SOS | SOS triggered | EMERGENCY: Ama sent an SOS at 6:45pm. Live location: [link]. Call Ama now. If you can't reach Ama, call 112. |
| All clear | User confirms OK | Ama is safe and confirmed at 6:52pm. – Reached |
| Request reply (Phase 2) | Contact sent REACHED | "Ama will let you know when Ama reaches." / "Ama can't share right now." |
| Test | Send test message | This is a test from Reached on Ama's phone. No action needed. |

Sender name: a branded sender ID (REACHED) can't receive replies; STOP opt-outs and REACHED requests need a two-way number/short code or WhatsApp. Overdue alerts add "Ama's phone may be off" when check-ins stopped.

**Live location page (Phase 2)** — web page, no login: live map refreshed every 30 s, "Last updated 1 min ago", trip status, **Call Ama**, trip details only in emergencies, expires at trip end or 2 h after an alert is cleared ("This trip has ended"), footer "Get Reached for yourself".

## 12. Push notifications

| Notification | When | Buttons | Opens |
| --- | --- | --- | --- |
| Told Mom you reached Work | Arrival sent | — | Event detail |
| You've reached Work. Tell Mom? | Ask me first on | Send · Not now | Arrived |
| Heading out? (Phase 2) | Leaving detected | Notify when I arrive · Not now | Start a trip |
| Are you okay? | Trip overdue | I'm okay · Need more time · Get help | Overdue screen |
| Alert sent to your contacts | No response | I'm safe now | Overdue screen |
| Mom wants to know when you reach (Phase 2) | Contact request | Accept · Decline | Home |
| Message to Mom failed | Not delivered | Retry | Event detail |
| Arrivals may not work | Permission/battery changed | Fix | Permissions and battery |
| Trip in progress | Ongoing during active trip (Android needs it for background location) | I've arrived | Active trip |

## 13. Edge cases

| Situation | Behaviour |
| --- | --- |
| Phone dies mid-trip | Server keeps last check-in and runs overdue check; alert adds "phone may be off" |
| No data at arrival | Queue and send when back; after 5 min offline, open phone's SMS app with message ready (Play restricts apps sending SMS themselves) |
| Traffic / waiting at a station | Arrival counts only after minimum stop time and not while phone reports being in a vehicle |
| Already inside destination at trip start | "You're already at Work. Send arrival now?" Send · Cancel |
| Bouncing at zone edge | Same place can't trigger the same message again within 1 hour |
| Two rules fire at once | One combined message per contact |
| Contact replied STOP | Skip them, mark Opted out, tell user once |
| Message failed | Status Failed, push with Retry |
| Free SMS allowance used (Phase 3) | Switch arrivals to WhatsApp where possible; overdue and SOS always sent |
| App force-closed | Server notices check-ins stopped during a trip; overdue still works; battery Fix banner on next open |
| No internet at first launch | "Connect to the internet to sign up" + Try again |
| No contacts / no places | Empty states with Add contact / Add place |

## 14. Open decisions (Claude: pick sensible defaults and record them in DECISIONS.md)

- Default arrival behaviour: send automatically (current default).
- Minimum age; whether parents can set up for teens.
- Free plan limits (contacts, places, SMS per month).
- Replies and opt-outs: two-way SMS number/short code vs WhatsApp only.
- Payment provider for premium (Phase 3).
