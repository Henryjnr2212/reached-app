# Manual tests

Everything here needs a real phone, a real SIM, or a live account, so it can't run in CI. Do these before launch, ideally on a **Tecno or Infinix** (aggressive battery management) and a **Samsung**, plus one **iPhone**, around Accra.

## What you need to provide first

| # | What | Where it goes | Why |
|---|---|---|---|
| 1 | Supabase project (URL, anon key, service role key) | `.env` / Supabase dashboard; `EXPO_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*` | Hosted database, auth, functions and cron |
| 2 | Africa's Talking account: username, API key, approved sender ID **REACHED**, a two-way short code or long number | `AFRICASTALKING_*` (Supabase function secrets) | Real SMS, delivery reports, STOP/REACHED replies |
| 3 | Callback URLs set in Africa's Talking: delivery reports → `/functions/v1/sms-delivery?token=…`, incoming messages → `/functions/v1/sms-inbound?token=…` | Africa's Talking dashboard | Sent → Delivered status and opt-outs |
| 4 | Supabase Auth phone provider on, with the **Send SMS hook** pointing to the `send-sms` function; hook secret | `SEND_SMS_HOOK_SECRET` | OTP codes by SMS through Africa's Talking |
| 5 | `DISPATCH_SECRET` (any long random string), also stored in the database: `insert into private.settings (key, value) values ('dispatch_secret', '…'), ('functions_url', 'https://<project>.supabase.co/functions/v1') on conflict (key) do update set value = excluded.value;` | Function secrets + SQL editor | The database wakes the dispatch function |
| 6 | Expo account + EAS project; `EXPO_ACCESS_TOKEN` (optional) | `eas.json`, `app.config.ts` `extra.eas.projectId` | Development and store builds, push notifications |
| 7 | Firebase project with `google-services.json` (Android push via FCM) and an APNs key (iOS push) | EAS credentials | Push notifications |
| 8 | Google Maps API key (Android maps SDK) | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps on Android |
| 9 | Android SMS Retriever hash for the release signing key | `ANDROID_SMS_HASH` | OTP auto-fill on Android |
| 10 | WhatsApp Cloud API: access token, phone number ID, verify token, app secret, approved templates | `WHATSAPP_*` | Phase 2 WhatsApp messages |
| 11 | GhanaPost GPS API access | `GHANAPOST_MODE=live`, `GHANAPOST_API_*` | Real digital address lookup (fake mode resolves test codes) |
| 12 | Payment provider for MoMo / Telecel Cash / AT Money / card (e.g. Hubtel or Paystack) | `PAYMENTS_*` | Premium and Family plans |
| 13 | Domain (e.g. reached.app) on Vercel for `apps/web` | `NEXT_PUBLIC_SITE_URL`, `LIVE_BASE_URL`, `EXPO_PUBLIC_WEB_URL` | Privacy, Terms, account deletion, live links |
| 14 | Data Protection Commission registration number | `NEXT_PUBLIC_DPC_REGISTRATION_NUMBER` | Shown in the Privacy Policy (currently "PENDING") |
| 15 | Support WhatsApp number and privacy email | `EXPO_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_PRIVACY_EMAIL` | Help and contact links |
| 16 | Apple Developer and Google Play Console accounts (Osnw Tech Studio, needs D-U-N-S) | EAS submit | Store releases |

Then set `MESSAGING_MODE=live` **only** on the production functions. Everything else stays `fake`.

## Build for a phone

```bash
pnpm install
cd apps/mobile
eas build --profile development --platform android   # or ios
# install the build, then:
npx expo start --dev-client
```

For the Maestro flows: `maestro test .maestro/` with the phone or an emulator connected (Android emulator: Extended controls → Location for GPS).

## Tests

Tick each one and write the phone model and date next to it.

### Sign-up and onboarding
1. Fresh install → splash → 3 welcome slides → enter your real number → the OTP SMS arrives from REACHED within 30 seconds and **fills itself in** on Android. Wrong code shakes and says "That code isn't right."
2. **Resend code** is disabled for 60 seconds, then sends a new code.
3. Add a real contact (a second phone you have). That phone receives the intro SMS word for word: "Hi, Ama added you as a safety contact on Reached…"
4. **Choose from contacts** asks for contacts permission and fills name and number from the phone book.
5. Location: allow while using, then "Allow all the time" via **Open settings** (Android 11+). Notifications: allow. Android battery step: **Fix it** opens the right settings page on Tecno/Infinix/Samsung; follow the brand steps.
6. Where's home → Use my current location → Done → Home.

### Background arrival (the riskiest part)
7. With "Allow all the time", lock the phone and travel (walk, trotro or car) from more than 1 km away to a saved place with a rule. The contact receives "Ama has arrived safely at Work (8:42am). - Reached" within 3 minutes of arriving. Repeat with the app swiped away from recents.
8. Repeat 7 on the Tecno/Infinix **without** removing battery restrictions and note whether it works; if not, the Home banner "Keep Reached running" must appear.
9. Drive **through** a saved place's zone in traffic without stopping: no message is sent.
10. Walk out and back in at the zone edge several times within an hour: only one message.
11. Start a trip to a destination; arrive with the phone locked; the Arrived notification "Told Mom you reached Work" appears and the contact gets the SMS. The Arrived screen shows Sending → Sent → Delivered from real delivery reports.
12. The ongoing "Trip in progress" notification shows on Android during a trip and its **I've arrived** button works.

### Ask me first
13. Set Arrivals → Ask me first. Arrive at a place: the notification "You've reached Work. Tell Mom?" shows **Send / Not now** buttons that work from the lock screen. Ignore it: it sends after 5 minutes.

### Overdue and emergency
14. Start a trip with a 10-minute expected time and 10-minute grace; don't arrive. At 20 minutes "Are you okay?" arrives as a full-screen alert with sound. Test each answer: I'm okay → Yes / Still on the way; Need more time; Get help.
15. Don't answer: after 5 minutes the emergency contact receives the ALERT SMS with a live link. **I'm safe now** asks for fingerprint/face/PIN, then the contact gets "Ama is safe and confirmed at…".
16. Turn the phone **off** mid-trip: the server still sends the overdue alert, and it includes "Ama's phone may be off."
17. SOS: hold the shield 3 seconds → 5-second countdown → Cancel works. Hold again and let it send: emergency contacts get the EMERGENCY SMS within 30 seconds; the live link updates every 30 seconds; tap-to-call 112 opens the dialer.

### Messages and contacts
18. From the contact phone, reply **STOP** to the Reached number: the contact shows "Opted out" and you get one notification; no more texts go to them. Reply **START** to undo.
19. Add a contact whose phone is off: the message shows Failed with a reason and a push with **Retry**.
20. Send a test message from contact detail: it arrives as "This is a test from Reached on Ama's phone. No action needed."
21. Turn off mobile data, arrive somewhere: the message queues and sends when data is back; after 5 minutes offline the phone's SMS app opens with the message ready.

### Settings and privacy
22. Privacy Policy and Terms open inside the app and show the last-updated date and the DPC number.
23. Download my data opens the share sheet with a JSON file.
24. Delete account asks for an OTP and removes everything; the web page at /delete-account does the same.
25. Run a test (Permissions and battery) sends the arrival text only to you.
26. Change number: OTP to the new number, then sign in with it.
27. Light, Dark and Match phone look right on a 360dp-wide phone; TalkBack/VoiceOver read every button.

### Phase 2 and 3 (when those accounts exist)
28. Contact replies **REACHED**: the request card appears; Accept watches for arrival; no answer in 15 minutes texts "Ama hasn't responded yet".
29. Hands-free SOS: press power 3 times quickly (Android) or use the Siri/Shortcut on iPhone: one vibration, nothing on screen, alert sent.
30. Share a Bolt/Uber/Yango trip link to Reached; screenshot a driver card and confirm plate/name fill in.
31. WhatsApp messages arrive using the approved templates.
32. Twi, Ga and Ewe messages checked by native speakers.
33. Premium purchase with MTN MoMo prompt on the phone; plan activates; limits increase.
34. Police: confirm emergency numbers (112, 191, 193, 192) and the station list with the Ghana Police Service before turning on "Also alert the police".
