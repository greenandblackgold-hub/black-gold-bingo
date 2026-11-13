# Black Gold PLC Bingo PRO: start here

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
| Prize | 80% | The winner gets 80% of all card sales in that round. You keep 20% (before Chapa fees and any taxes). Example: 20 cards x 10 = 200 birr in, 160 paid to the winner, 40 stays with you. |
| Cash-outs | You press one button | When a player asks to cash out, you see the request in your Control Center, check it, and press **Pay**. This is the safe way to start. |
| Deposits | 10 to 10,000 birr | Players top up through Chapa (Telebirr, CBE Birr, cards) |
| Minimum cash-out | 50 birr | |
| Room name | BINGO-99 | |
| Auto-calling | You choose 1 to 60 seconds in the Control Center | The server draws the numbers, so it keeps running even if you close the page |

To change a setting later, open Render, your service, **Environment**, edit the value, **Save**. It restarts by itself.

---

## Costs

- **GitHub:** free.
- **MongoDB Atlas (database):** the free plan is fine for testing. Before you hold real players' money, upgrade to a paid plan that includes **backups**.
- **Render (runs the game):** the **Starter** plan is a small monthly fee. Check the current price on render.com. Do not use the free plan for a real business: it falls asleep when nobody visits, and a sleeping game cannot call numbers or confirm payments.
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

## Running a game (every time)

1. Players buy cards **before** the round starts (cards cannot be bought once it has started).
2. You: **Control Center, Start round.**
3. You: switch **Auto-call** on (5 to 10 seconds is comfortable) or press **Draw next number**.
4. A player completes a line and presses **Call BINGO!**. The server checks it and ends the round, shows the winning card to everyone and pays the prize into the winner's wallet. Nothing for you to do.
5. You: press **New round**. Everyone's old cards are cleared and a new round begins.

## Paying cash-outs (every day)

Open **Control Center**. Under **Cash-out requests** you see the amount, name and account number. Check them, then press **Pay** (or **Reject**, and the money goes back to the player's wallet). If it shows **Sending** for a long time, press **Check status**.

---

## If something looks wrong

- **The site does not open:** in Render, click your service and look for **Live**. If it says failed, open **Logs** and send me a screenshot.
- **Players cannot pay:** check that the Chapa key in Render has no spaces before or after it.
- **You forgot your owner PIN:** change `ADMIN_PIN` in Render, Environment, Save. It becomes your PIN after the restart.
- **Anything else:** send me a screenshot of the page and of Render's **Logs** and I will fix it.

---

## What is not covered yet (be aware)

- **Phone numbers are not verified.** Anyone can register any number. Adding an SMS code is the first improvement I recommend before you advertise.
- **Age and ID are not checked.** The sign-up page says 18+, and nothing enforces it.
- **No tax is deducted** from prizes (see the licence note).
- **Only one copy of the game may run.** Do not change the instance count in Render.
- **Telebirr direct** is not built (it needs a contract with Ethio telecom). Players can still pay with Telebirr through Chapa.

## Test and deployment status

Automated test files are included in `deploy/test/`, and a GitHub Actions workflow has been added to run them on pushes and pull requests. Do not assume tests have passed until the workflow shows a successful result. The real MongoDB Atlas connection, Chapa test checkout, Render deployment, and full browser journey still need to be verified using your own service accounts. Complete Step 6 with test money before considering a live launch.
