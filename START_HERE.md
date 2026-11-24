# Black Gold PLC Bingo PRO: start here

> **CURRENT DEPLOYMENT NOTE (15 Nov 2026):** The active Render configuration is `deploy/render.yaml`. In Render choose **New + → Blueprint**, connect this repository, and set the Blueprint file path to `deploy/render.yaml`. There is intentionally no root `package.json`: the backend package is `deploy/package.json` and the frontend package is `client-source/package.json`. The Blueprint installs both, runs the frontend TypeScript check and production build, copies the website into `deploy/public`, runs backend tests, and starts the Node server with `npm --prefix deploy start`. The GitHub Actions workflow checks the same frontend typecheck/build and backend tests.
>
> **Only three private values need your input during first setup:** `MONGODB_URI` (your MongoDB Atlas connection string), `ADMIN_PHONE` (your owner phone number), and `ADMIN_PIN` (a new six-digit PIN). Render generates `JWT_SECRET` and `SMS_WEBHOOK_SECRET` automatically. Do not paste private values into GitHub or this chat. The Blueprint cannot create a MongoDB Atlas account/cluster or know your owner phone/PIN, so these three values cannot safely be filled in automatically.
>
> **Safety:** this project is configured for simulation-only ETB credits. Real-money features remain disabled. A successful GitHub build does not prove that a Render service is deployed or that MongoDB credentials are correct.

---

You do not need to write, read or fix any code. Follow the steps in order. Each step is clicking and copy-pasting.

**Time needed:** about 1 to 1.5 hours the first time.
**You need:** a computer, an email address, your phone, and a way to pay a small monthly hosting fee (see Costs).

---

## Two things you must know first

**1. I can't press the buttons for you.** Creating accounts, accepting terms and typing your passwords has to be done by you. I can't log in to GitHub, MongoDB, Render or Chapa for you. The old live page was not safe: it exposed temporary OTP codes in logs and contained startup code that could delete player records. The server has been corrected in GitHub, but the new version has not yet been deployed and fully verified. Do not invite players or accept money.

**2. Real-money Bingo needs official clearance.** Ethiopia's Ministry of Justice explains that Bingo/lottery categories have different rules, and the required permit must come from the National Lottery Administration. We must confirm the exact category and get the correct permit in writing. Chapa must also approve this exact business model in writing before we use its payment service. The application now keeps real-money functions OFF by default.

---

## What I already decided for you

| Setting | Value | What it means |
|---|---|---|
| Card price | 10 birr | Players pay 10 birr per card |
| Prize | 45% | The winner gets 45% of all card sales in that round. You keep 55% before operating costs, provider fees and any applicable taxes. Example: 20 cards x 10 = 200 birr in, 90 birr goes to the winner and 110 birr remains before those costs. |
| Cash-outs | You press one button | When a player asks to cash out, you see the request in your Control Center, check it, and press **Pay**. This is the safe way to start. |
| Deposits | Simulation only | Player submits amount + transaction reference. Trusted Admin-phone SMS only matches evidence; wallet credit requires independent Admin verification and explicit Approve. Chapa/live deposits remain disabled. |
| Minimum cash-out | 50 birr | |
| Room name | BINGO-99 | |
| Auto-calling | You choose 1 to 60 seconds in the Control Center | The server draws the numbers, so it keeps running even if you close the page |

To change a setting later, open Render, your service, **Environment**, edit the value, **Save**. It restarts by itself.

---

## Costs

- **GitHub:** free.
- **MongoDB Atlas (database):** the free plan is fine for testing. Before you hold real players' money, upgrade to a paid plan that includes **backups**.
- **Render (runs the game):** the current `black-gold-bingo` service is on the **Free** plan. It may sleep after inactivity and wake slowly; it is suitable only for simulation/testing, not continuous live operation. A paid plan is required before a real business launch.
- **Chapa:** takes a fee on payments and payouts. Check their price list.
- **Netlify:** not needed. I built the website into the same program, so there is only one thing to put online.

---

## Step 1: GitHub repository (already completed)

Your repository is already connected:
`https://github.com/greenandblackgold-hub/black-gold-bingo`

Keep the existing folder structure. The deployment package and Render Blueprint are inside `deploy/`; do not upload a second copy of the folder contents or create a duplicate repository.

## Step 2: Create the database, MongoDB Atlas (about 15 minutes)

1. Go to **mongodb.com/atlas** and create a free account.
2. Create a **cluster**: choose the **Free (M0)** plan and any region close to Ethiopia (Europe or the Middle East if offered). Click **Create**.
3. When it asks about security:
   - **Username and password:** make a username (for example `bingo`) and a long password. **Write the password down.** Avoid symbols like `@ : / ?` in the password to keep things simple. Click **Create user**.
   - **Where to connect from:** for a quick test, Atlas can temporarily allow `0.0.0.0/0`, but this exposes the database port to the internet. For production, restrict access to Render's current outbound IP ranges where possible, use a strong unique database password, and never publish the connection string.
4. Click **Connect**, then **Drivers**. You will see a line starting with `mongodb+srv://...`. Click the copy button.
5. Paste it into a note on your computer. Replace `<password>` in it with the password you wrote down (remove the `<` and `>` too).

Keep that note. You will paste it in Step 4.

## Step 3: Chapa approval (do not create or share a key yet)

Do not create a live payment key or send money through Chapa yet. First ask Chapa support to confirm in writing that they accept this exact model: paid Bingo cards, a player wallet, prize credits and cash-outs. Their terms may restrict monetizable wallet balances. We will add the payment key only after they approve the model.

## Step 4: Put the game online with Render (about 15 minutes)

1. Go to **render.com** and sign in.
2. Click **New**, then **Blueprint**. Connect GitHub and choose `greenandblackgold-hub/black-gold-bingo`.
3. Set the Blueprint file path to `deploy/render.yaml`. The service is configured to run from the `deploy` folder.
3. Render will ask for the database address and owner login details:
   - **MONGODB_URI:** paste the private MongoDB connection string.
   - **ADMIN_PHONE:** your owner phone number.
   - **ADMIN_PIN:** a new 6-digit owner PIN. Do not reuse a PIN used elsewhere.
   - **JWT_SECRET:** Render generates this automatically.
4. The Blueprint keeps real-money deposits, paid card purchases and cash-outs disabled. Do not switch them on yet.
4. Click **Apply** (or **Deploy**). Render builds it. Wait about 3 to 5 minutes until you see **Live**.
5. At the top of the page is your address, like `https://black-gold-bingo.onrender.com`. **Open it.** You should see the gold Sign in page.

## Step 5: Payment notifications (wait)

Skip this step until Chapa has approved the Bingo business in writing and we have added the approved credentials. Do not configure live payments or webhooks yet.

## Step 6: Safe testing (not yet ready)

The current public page is intentionally a maintenance screen while the full player interface is rebuilt and verified against the secure API. No real deposits, paid cards or cash-outs are available. Do not invite players or accept money. After the new version is deployed, we will test the full player and owner journey with fake transactions first.

## Step 7: Real-money launch (only after every approval)

We will not enable real money until all of these are confirmed:
1. The National Lottery Administration confirms in writing the correct Bingo category and issues the required permit.
2. Chapa confirms in writing that it accepts this exact Bingo, wallet, prize and cash-out model, and approves the merchant account and payouts.
3. The website passes its security tests, phone verification and age/identity checks, payment verification, and end-to-end test transactions.
4. A local lawyer/accountant confirms the tax, prize and reporting requirements.

Only after those steps will we enter approved payment credentials and switch on real-money mode. Never send a password, PIN, bank login or API key in this chat.

---

## Running a game

This section is not active yet. The public site is currently in safe maintenance mode. Do not start paid rounds, invite players or accept money. We will restore these instructions only after the new player interface and owner control center pass the full test.

## Paying cash-outs

Cash-outs are disabled. Do not promise or send payouts through the old site. Existing balances and any previous payment records must be checked and reconciled before real-money operation resumes.

---

## If something looks wrong

- **The site does not open:** in Render, click your service and look for **Live**. If it says failed, open **Logs** and send me a screenshot.
- **Players cannot pay:** payments are intentionally disabled until the legal permit and Chapa's written approval are confirmed.
- **You forgot your owner PIN:** change `ADMIN_PIN` in Render, Environment, Save. It becomes your PIN after the restart.
- **Anything else:** send me a screenshot of the page and of Render's **Logs** and I will fix it.

---

## What still needs to be completed

- Real SMS phone verification and age/identity checks.
- The complete player and owner interfaces must be rebuilt and tested against the secure API.
- Existing database records and any old balances must be audited before migration.
- The official Bingo category, permit, taxes and Chapa merchant approval must be confirmed.
- The payment provider's live checkout and payout flows must pass end-to-end tests.
- Only one game server instance should run because the live draw scheduler is single-instance.

## Test and deployment status

Automated test files are included in `deploy/test/`, and a GitHub Actions workflow has been added to run them on pushes and pull requests. Do not assume tests have passed until the workflow shows a successful result. The real MongoDB Atlas connection, Chapa test checkout, Render deployment, and full browser journey still need to be verified using your own service accounts. Complete Step 6 with test money before considering a live launch.


## Admin-phone SMS Bridge for the simulation wallet

1. The player submits only an ETB amount and bank transaction reference. Do not ask players to paste SMS messages.
2. The API creates a pending request; the wallet balance does not change.
3. On the trusted Admin Android APK, open **Admin → SMS Sync**, tap **Reconnect**, and grant SMS permission. The app obtains a scoped token and configures the native bridge.
4. The trusted phone forwards incoming SMS to `/api/webhooks/sms/device`. The server matches the transaction reference and amount to the pending request.
5. **SMS matching never credits a wallet.** Admin independently verifies the bank/Telebirr receipt and explicitly clicks **Approve**. Mismatches remain pending for review or are rejected.
6. Duplicate SMS events and repeated approvals cannot credit the same request twice.

The signed `/api/webhooks/sms` route is retained for trusted external adapters. It also matches evidence only and never bypasses Admin approval.

### Local setup

Requirements: Node.js 20.6 or newer (Node.js 22 is recommended). In PowerShell, from the project root, build the website first and then start the API:

```powershell
cd client-source
npm install --include=dev
$env:VITE_SERVER_MODE="true"; npm run build
New-Item -ItemType Directory -Force ../deploy/public | Out-Null
Copy-Item -Path dist/* -Destination ../deploy/public/ -Recurse -Force
cd ../deploy
npm install
```

Create `deploy/.env` from `deploy/.env.example` and replace both placeholder secrets. The development command loads this file automatically:

```dotenv
NODE_ENV=development
PORT=8080
STORAGE=memory
JWT_SECRET=replace-this-with-a-random-secret-at-least-32-characters
SMS_WEBHOOK_SECRET=replace-this-with-a-different-random-secret-at-least-32-characters
ADMIN_PHONE=0900000001
ADMIN_PIN=654321
REGISTRATION_ENABLED=true
```

Start the server:

```bash
npm run dev
```

Open `http://localhost:8080`. Memory storage is for local testing only; its data is cleared when the server restarts. For persistent hosted use, configure MongoDB Atlas with `STORAGE=mongo` and `MONGODB_URI`, plus a strong private `JWT_SECRET` and `SMS_WEBHOOK_SECRET`.

### Test the complete flow locally

1. Start the server and sign in to the website.
2. In the wallet, submit a test amount and reference such as `TXN123456789`.
3. Open a second terminal, go to `deploy`, and send a signed fake SMS event:

```powershell
npm run simulate:sms -- TXN123456789 100
```

Use the same reference and amount entered in the wallet. The SMS only matches the pending request; an Admin must approve it before the balance changes. This command is only a local test tool; it does not read a real phone SMS or contact a bank.

### Webhook event format

The SMS gateway adapter must translate the provider's notification into this JSON shape (do not forward arbitrary user-submitted text as a trusted event):

```json
{
  "eventId": "provider-event-unique-id",
  "reference": "TXN123456789",
  "amount": 100,
  "currency": "ETB",
  "status": "success"
}
```

Sign the exact serialized body:

```js
import { createHmac } from 'node:crypto';
const rawBody = JSON.stringify(event);
const signature = createHmac('sha256', process.env.SMS_WEBHOOK_SECRET)
  .update(rawBody, 'utf8').digest('hex');
// POST rawBody to /api/webhooks/sms with X-SMS-Signature: signature
```

**Important:** this repository includes the signed webhook receiver and simulation wallet flow. It does not yet connect to a particular bank, Telebirr, or SMS-forwarding vendor. That vendor's authenticated SMS receiver/adapter and credentials must be configured separately. Never put the webhook secret in the browser or send it in chat. The ETB balance here is simulated game credit, not a real bank balance or cash payment.


## Updated Render deployment and Android SMS Forwarder setup

This section supersedes the older Render notes above where they say public registration is disabled or the player interface is a maintenance page.

### Deploy the complete website and API together

The Render Blueprint at `deploy/render.yaml` builds the React website, copies it into the backend's static folder, runs the backend tests, and starts one Node service. You do not need a separate frontend host.

1. Sign in to **Render** and open the existing service created from this repository (the Blueprint service name is `black-gold-bingo`).
2. If you have not created it yet: choose **New + → Blueprint**, connect GitHub, select `greenandblackgold-hub/black-gold-bingo`, and set Blueprint file to `deploy/render.yaml`.
3. In the service's **Environment** tab, set:
   - `MONGODB_URI`: your private MongoDB Atlas connection string.
   - `ADMIN_PHONE`: the phone number you will use for the owner account.
   - `ADMIN_PIN`: a new six-digit owner PIN.
   - `JWT_SECRET` and `SMS_WEBHOOK_SECRET`: Render generates these from the Blueprint. Keep them private.
   - `REGISTRATION_ENABLED`: `true`.
   - `REAL_MONEY_ENABLED`: `false`.
4. Click **Save Changes** if you edited environment values. Open **Manual Deploy → Deploy latest commit** if Render does not automatically deploy the latest GitHub commit.
5. Wait for the deploy to finish and for the service status to show **Live**. Open the `onrender.com` URL shown at the top. Both the website and API use this same address.
6. Check the health endpoint by opening `https://YOUR-SERVICE.onrender.com/health`. It should return JSON with `"ok": true`.

The Render build command installs the backend and frontend dependencies, builds the frontend with server mode enabled, copies the built files to `deploy/public`, and runs the backend tests. The start command starts the backend, which serves both the API and the built website. Keep the service at one instance because the live game scheduler is single-instance.

### Public registration

Production registration is enabled by the Blueprint default. Players can create an account with their phone number, name and PIN without receiving an SMS verification code. The phone number is therefore a login identifier only; it is **not proof that the player owns that number**. Use unique PINs and keep the real-money functions disabled.

### Android SMS Bridge

The Android APK includes the native Admin SMS Bridge. Sign in as Admin, open **Admin → SMS Sync**, tap **Reconnect**, and grant SMS permission. The app requests a scoped token from `/api/admin/sms-device/token` and configures forwarding to `/api/webhooks/sms/device` automatically.

Keep this bridge on the trusted Admin phone. Do not forward outgoing/debit notifications. Incoming SMS is matched to a pending amount/reference request as evidence only; Admin must independently verify the receipt and press **Approve** before the wallet balance changes.

For a separate trusted adapter, use the signed `POST /api/webhooks/sms` endpoint with HMAC-SHA256 and `SMS_WEBHOOK_SECRET`. Never put a token or secret in the browser, APK source, public repository, or chat.

This is a simulation evidence matcher, not bank-grade proof of payment. Real-money deposits and payouts remain disabled.

### What to expect after deployment

- Registration: open.
- Website and API: served by the same Render service.
- Wallet: simulation ETB only.
- SMS webhook: accepts authenticated forwarding requests and parses the supported sender labels.
- Real-money deposits, withdrawals and payouts: remain disabled.
