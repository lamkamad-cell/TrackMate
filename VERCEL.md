# TrackMate Vercel Deploy

Vercel is a good free HTTPS host for this PWA prototype.

## What works on Vercel Free

- PWA over HTTPS
- Installable app shell
- User A and User B screens
- PeerJS/WebRTC camera and microphone consent flow
- Browser geolocation permission flow
- Client-side heartbeat alert while User A keeps the app open
- Supabase-backed heartbeat and push subscription storage

## Limitation

Vercel Hobby serverless functions are not a long-running Node server. The 15-second background heartbeat push detector from `server.js` is still better suited to Render, Koyeb, Fly.io, or another always-on/background-capable host.

This repo now includes Supabase persistence and `/api/check-heartbeats` for scheduled checks. Vercel Hobby cron is limited to daily runs, so it is only a background fallback, not a 15-second realtime safety loop.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL migration in `supabase/migrations/20260916000000_trackmate_core.sql`.
3. Copy your project URL and service role key from Supabase dashboard.
4. Keep the service role key server-side only. Never put it in `trackmate.html`.

## Required Vercel Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`, for example `mailto:email-anda@example.com`

## Optional Vercel Environment Variables

- `CRON_SECRET`, protects `/api/check-heartbeats` if configured
- `HEARTBEAT_TIMEOUT_SECONDS`, default `60`
- `NOTIFICATION_COOLDOWN_SECONDS`, default `300`
- `TURN_URLS`, comma-separated TURN URLs for stricter NAT/mobile networks
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

TrackMate includes public STUN servers and an Open Relay TURN fallback by default for prototypes. For production or heavy testing, use your own TURN service such as Twilio Network Traversal or Metered TURN and set the TURN variables above.

## Deploy Steps

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Framework preset: Other.
4. Build command: leave empty or use `npm install`.
5. Output directory: leave empty.
6. Add the required environment variables above.
7. Deploy.

## Runtime Endpoints

- `/api/push/public-key` exposes the VAPID public key to the browser.
- `/api/push/subscribe` stores User A push subscriptions in Supabase.
- `/api/heartbeat` stores User B heartbeat status in Supabase.
- `/api/check-heartbeats` checks stale heartbeats and sends Web Push notifications.
- `/api/webrtc-config` exposes STUN/TURN ICE server config to PeerJS.
