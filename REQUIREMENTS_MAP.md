# Requirements map

Spec requirement → PROGRESS item → tests → status. Test short names are explained at the top of `PROGRESS.md`. "covered" means automated tests pass; a "manual #n" note means part of it can only be checked on a real phone or live account (`MANUAL_TESTS.md`).

| ID | Requirement (spec section) | Phase | PROGRESS | Tests | Status |
|---|---|---|---|---|---|
| R1 | Splash → Home or Welcome (§3.1) | 1 | 1.1 | e2e-m onboarding | covered |
| R2 | Welcome slides, Skip/Next/Get started (§3.2) | 1 | 1.2 | e2e-m onboarding | covered |
| R3 | Phone +233, Send code disabled until valid, Terms/Privacy links (§3.3) | 1 | 1.3 | e2e-m onboarding; core phone | covered |
| R4 | Verify code, wrong code, resend after 60 s, change number (§3.4) | 1 | 1.4–1.5 | e2e-m onboarding; fn send-sms | covered; auto-read manual #1 |
| R5 | Your name, used in messages (§3.5) | 1 | 1.6 | e2e-m onboarding | covered |
| R6 | First contact: pick or enter; intro SMS; skip → Home card (§3.6) | 1 | 1.7 | e2e-m onboarding; db 006 | covered; picker manual #4 |
| R7 | Location explainers incl. "all the time"; Not now banner (§3.7) | 1 | 1.8 | e2e-m onboarding | covered; prompts manual #5 |
| R8 | Notifications explainer (§3.8) | 1 | 1.9 | e2e-m onboarding | covered |
| R9 | Keep Reached running, brand steps (§3.9) | 1 | 1.10 | core phase23 battery | covered; device manual #5, #8 |
| R10 | Where's home + tell first contact toggle (§3.10) | 1 | 1.11 | e2e-m onboarding | covered |
| R11 | Home: greeting, SOS, banners, status card, Start a trip, Send now, quick places, recent activity (§4) | 1 | 2.1–2.6 | e2e-m smoke, trip, onboarding | covered |
| R12 | Home: contact request and heading-out cards (§4) | 2 | 2.7 | e2e-m activity; mobile smart | covered |
| R13 | Start a trip: destination options, who to tell, message edit (§5) | 1 | 3.1–3.2 | e2e-m trip; fn geocode | covered |
| R14 | Tell them I'm leaving now (§5) | 1 | 3.3 | e2e-m trip; db 003 | covered |
| R15 | Check on me if late, grace, no-destination options (§5) | 1 | 3.4 | db 003, 004; core logic | covered |
| R16 | Trip details, ride link, screenshot import (§5) | 2 | 3.5 | core phase23; fn partner-api | covered; OCR manual #30 |
| R17 | Active trip: arrived, running late, share live, edit, cancel options (§5) | 1 | 3.6 | e2e-m trip | covered |
| R18 | Arrival detection, min stop, not in vehicle (§5, §13) | 1 | 3.7 | core logic; mobile tracker; e2e-m trip | covered; background manual #7–#9 |
| R19 | Already inside destination (§13) | 1 | 3.8 | e2e-m trip | covered |
| R20 | Auto-send and Ask me first with 5-minute fallback (§5) | 1 | 3.9 | e2e-m activity; db 005, 011 | covered; push buttons manual #13 |
| R21 | Arrived screen with per-contact delivery status (§5) | 1 | 3.10 | e2e-m trip; fn sms-delivery | covered |
| R22 | Places list, add/edit, zone 100–500 m, place detail, delete confirm (§6) | 1 | 4.1–4.4 | e2e-m places; core logic | covered |
| R23 | Rule screen: arrive/leave, contacts, days, window, message (§6) | 1 | 4.5 | e2e-m places; core logic | covered |
| R24 | Rules fire; combined message; 1-hour duplicate window (§6, §13) | 1 | 4.6 | core logic; db 005; e2e-m places | covered |
| R25 | Max 15 places (§6) | 1 | 4.7 | db 010; core phase23 | covered |
| R26 | Suggested places (§6) | 2 | 4.8 | core phase23; e2e-m places | covered |
| R27 | Contacts list with badges (§7) | 1 | 5.1 | e2e-m contacts | covered |
| R28 | Add contact, validation, intro SMS (§7) | 1 | 5.2 | e2e-m contacts; core phase23 | covered |
| R29 | Contact detail, test message, remove from rules (§7) | 1 | 5.3 | e2e-m contacts; db 005; mobile demoBackend | covered |
| R30 | STOP opt-out (§7, §13) | 1 | 5.4 | e2e-m contacts; fn sms-inbound, whatsapp-webhook; db 006 | covered; live manual #18 |
| R31 | Contact requests via REACHED (§7) | 2 | 5.5 | fn sms-inbound; db 009; e2e-m activity | covered; live manual #28 |
| R32 | Message templates word for word (§11) | 1 | 6.1 | core messages | covered |
| R33 | ≤160 GSM-7 characters (§11, CLAUDE.md) | 1 | 6.2 | core messages; fn dispatch | covered |
| R34 | Sending, delivery reports, failure reasons, retry (§11, §13) | 1 | 6.3–6.4 | fn dispatch, sms-delivery; e2e-m contacts | covered; live manual #19 |
| R35 | "Phone may be off" in overdue alerts (§11, §13) | 1 | 6.5 | core logic; db 004 | covered; manual #16 |
| R36 | Local-language messages (§10) | 2 | 6.6 | core messages | covered; review manual #32 |
| R37 | Overdue: server check, Are you okay?, three answers (§8) | 1 | 7.1–7.2 | db 004, 011; e2e-m overdue | covered; full-screen alert manual #14 |
| R38 | 5-minute escalation with countdown (§8) | 1 | 7.3 | db 004; e2e-m overdue | covered |
| R39 | I'm safe now with unlock → All clear (§8) | 1 | 7.4 | e2e-m overdue, sos | covered; unlock manual #15 |
| R40 | SOS hold 3 s, hint, countdown, alert, numbers, 30 s pings (§8) | 1 | 7.5 | e2e-m sos; mobile components; db 007 | covered; live manual #17 |
| R41 | Alert contents incl. live link and battery (§8) | 1 | 7.6 | db 007; e2e-w live | covered |
| R42 | Hands-free SOS (§8) | 2 | 7.7 | settings screen render (e2e-m smoke) | manual #29 |
| R43 | Police finder, dashboard, alert switch (§8) | 3 | 7.8 | core phase23; e2e-w staff; db 010 | covered; partnership manual #34 |
| R44 | Activity filters, grouping, footer, empty state (§9) | 1 | 8.1 | e2e-m activity, smoke; core phase23 | covered |
| R45 | Event detail, Resend, This wasn't right (§9) | 1 | 8.2 | e2e-m activity, contacts | covered |
| R46 | Profile and change number (§10) | 1 | 9.1 | settings render; demo backend | covered; live OTP manual #26 |
| R47 | Arrivals settings (§10) | 1 | 9.2 | e2e-m activity, smoke | covered |
| R48 | Safety settings (§10) | 1 | 9.3 | e2e-m smoke; core emergency | covered |
| R49 | Notifications settings (§10) | 1 | 9.4 | e2e-m smoke | covered |
| R50 | Permissions and battery, Run a test (§10) | 1 | 9.5 | e2e-m activity | covered; manual #25 |
| R51 | Privacy and data: policy, terms, retention, delete activity, download, delete account (§10) | 1 | 9.6 | e2e-m settings, activity; db 008; fn delete-account | covered; manual #22–#24 |
| R52 | App and support: language, appearance, help, support, report, invite, rate, about, log out (§10) | 1 | 9.7 | e2e-m settings | covered |
| R53 | Plans and mobile money (§10) | 3 | 9.8 | e2e-m activity; fn payments; db 010 | covered; live manual #33 |
| R54 | Push notifications with buttons and routing (§12) | 1 | 10.1–10.2 | db 003, 004; fn dispatch | covered; delivery manual #11–#15 |
| R55 | Edge cases (§13) | 1 | 11.1–11.12 | see items | covered |
| R56 | Offline arrival queue + SMS app after 5 min (§13) | 1 | 3.12 | mobile outbox; e2e-m trip | covered; SMS app manual #21 |
| R57 | SMS allowance → WhatsApp, safety always sent (§13) | 3 | 11.9 | core phase23; db 010 | covered |
| R58 | Web: privacy, terms, account deletion, help (§10) | 1 | 12.1–12.4 | e2e-w pages, delete-account | covered |
| R59 | Live location page (§11) | 2 | 12.5 | e2e-w live; db 012 | covered |
| R60 | Police and admin dashboards (§1 Phase 3) | 3 | 12.6 | e2e-w staff | covered |
| R61 | Location pings deleted after 30 days; no precise locations in logs (CLAUDE.md) | 1 | 13.1–13.2 | db 008, 011; fn shared | covered |
| R62 | 360dp, 48dp targets, WCAG AA, light and dark (project rules) | 1 | 0.3, 0.7 | e2e-m a11y, smoke (both themes); core tokens; mobile components | covered |
| R63 | Never send real SMS unless MESSAGING_MODE=live; tests use FakeProvider (CLAUDE.md) | 1 | 0.4, 0.6 | fn providers | covered |
