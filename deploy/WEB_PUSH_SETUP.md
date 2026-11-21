# Web Push setup

Web Push is opt-in: a verified player must press **ማሳወቂያዎችን አንቃ** and accept the browser permission prompt. Notifications are delivered to the player's registered browser/device subscriptions, including when the app is closed (subject to browser/OS support and device connectivity).

## One-time Render configuration

1. From the `deploy` directory, run `npm run push:keys`.
2. Copy the generated values into the Render service `black-gold-bingo` → **Environment**:
   - `PUSH_VAPID_PUBLIC_KEY`
   - `PUSH_VAPID_PRIVATE_KEY` (secret; do not share or commit)
   - `PUSH_VAPID_SUBJECT` (a valid `mailto:` contact address)
3. Save the environment changes and let Render redeploy/restart the service.
4. Open the site on HTTPS in each browser/device and enable notifications while signed in to a verified player account.

Keep the same VAPID key pair permanently. Replacing it invalidates existing browser subscriptions; players would need to opt in again. If the VAPID keys are not configured, the app keeps its in-app announcements working and does not show the push opt-in prompt.

The service sends push notifications for the bonus announcements at two regular rounds remaining, one regular round remaining, and bonus-round start. Expired subscriptions (HTTP 404/410) are automatically removed.
