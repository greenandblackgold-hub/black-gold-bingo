# Black Gold PLC Bingo PRO: start here

You do not need to write, read or fix any code. Follow the steps in order. Each step is clicking and copy-pasting.

**Time needed:** about 1 to 1.5 hours the first time.
**You need:** a computer, an email address, your phone, and a way to pay a small monthly hosting fee (see Costs).

---

## Two things you must know first

**1. I can't press the buttons for you.** Creating accounts, accepting terms and typing your passwords has to be done by you. I can't log in to GitHub, MongoDB, Render or Chapa for you. Everything else is already built and tested: the website, the game, the wallets, the card sales, the prize payments and the cash-out system.

**2. A licence is needed before you take real money.** Bingo played for money is gambling. In Ethiopia the National Lottery Administration licenses this, and the rules and taxes have been changing. Use **test mode** (fake money, below) as long as you like. Before you switch to real money, ask a lawyer and the National Lottery Administration what you need, and ask Chapa whether they accept your business type. I am not a lawyer, and the game does not deduct any tax from prizes.

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

## Step 1: Put the files on GitHub (about 10 minutes)

Render reads your files from GitHub.

1. Unzip the file I gave you. You will see a folder called **deploy**.
2. Go to **github.com** and create a free account (or sign in).
3. Click the **+** at the top right, then **New repository**. Name it `black-gold-bingo`. Choose **Private**. Click **Create repository**.
4. On the next page click **uploading an existing file**.
5. Open the **deploy** folder on your computer. Select **everything inside it** (the `public`, `scripts`, `src`, `test` folders and the `package.json`, `render.yaml` files) and drag it all into the GitHub page.
   Upload the contents of `deploy`, **not** the folder called `deploy` itself.
6. Wait until the uploads finish, then click **Commit changes**.

You should now see `render.yaml` and `package.json` in the list of files on GitHub.

## Step 2: Create the database, MongoDB Atlas (about 15 minutes)

1. Go to **mongodb.com/atlas** and create a free account.
2. Create a **cluster**: choose the **Free (M0)** plan and any region close to Ethiopia (Europe or the Middle East if offered). Click **Create**.
3. When it asks about security:
   - **Username and password:** make a username (for example `bingo`) and a long password. **Write the password down.** Avoid symbols like `@ : / ?` in the password to keep things simple. Click **Create user**.
   - **Where to connect from:** choose **Add IP address**, type `0.0.0.0/0` and click **Add entry**. (This lets Render connect. Your long password keeps it safe.)
4. Click **Connect**, then **Drivers**. You will see a line starting with `mongodb+srv://...`. Click the copy button.
5. Paste it into a note on your computer. Replace `<password>` in it with the password you wrote down (remove the `<` and `>` too).

Keep that note. You will paste it in Step 4.

## Step 3: Get your Chapa key (about 10 minutes)

1. Go to **chapa.co** and create a business account.
2. Log in to the Chapa dashboard. Find **Settings**, then **API** (or **API Keys**).
3. Copy the **Secret Key**. While you are testing it starts with `CHASECK_TEST-`. **This is the test key, which uses pretend money.** That is exactly what you want first.
4. Paste it into your note.

## Step 4: Put the game online with Render (about 15 minutes)

1. Go to **render.com** and sign up with your GitHub account.
2. Click **New**, then **Blueprint**. Connect your GitHub and choose the repository `black-gold-bingo`.
3. Render shows a form with 4 empty boxes. Fill them in:
   - **MONGODB_URI:** paste the long `mongodb+srv://...` line from your note.
   - **CHAPA_SECRET_KEY:** paste the test key from your note.
   - **ADMIN_PHONE:** your own phone number, for example `0911223344`. This will be your owner login.
   - **ADMIN_PIN:** choose a 6-digit number that is hard to guess, for example `482913`. This is your owner password. **Write it down. Do not use 123456.**
4. Click **Apply** (or **Deploy**). Render builds it. Wait about 3 to 5 minutes until you see **Live**.
5. At the top of the page is your address, like `https://black-gold-bingo.onrender.com`. **Open it.** You should see the gold Sign in page.

## Step 5: Tell Chapa where to send payment news (2 minutes, recommended)

1. In the Chapa dashboard open the **webhook** settings.
2. Set the webhook address to your site address followed by `/api/payments/chapa/webhook`.
   Example: `https://black-gold-bingo.onrender.com/api/payments/chapa/webhook`
3. Save. (You can leave any "secret" box empty.)

Even without this step payments still get confirmed when the player returns to the site. This step makes it faster and more reliable.

## Step 6: Practise with pretend money (about 20 minutes)

1. Open your site and **sign in** with `ADMIN_PHONE` and `ADMIN_PIN`. At the top you will see **Control Center →**. Only you see it.
2. Open your site in a **private/incognito window** (this is a player). Click **Register**, make a player account with a different phone number.
3. As the player: **Wallet**, **Pay with Chapa**, and finish Chapa's **test** payment. Your balance should go up.
4. As the player: buy 2 cards on the **Wallet** page.
5. As you (owner): open **Control Center**, press **Start round**, then **Draw next number** a few times, or switch on **Auto-call**.
6. As the player: tap the called numbers on your card. When you complete a line, press **Call BINGO!**. The server checks it and pays the prize into the wallet.
7. As the player: **Wallet**, **Cash out**, send a request. As you: in the Control Center find **Cash-out requests** and press **Pay**.

If all of that worked, your business is running and the technical part is done.

## Step 7: Going live with real money (only after the licence is sorted)

1. Make sure your Chapa business account is fully approved for live payments and that **transfers (payouts)** are switched on and funded. Ask Chapa support if you cannot find it.
2. In Chapa, copy the **live** secret key.
3. In Render open your service, **Environment**, replace the value of `CHAPA_SECRET_KEY` with the live key, **Save**.
4. Do one real transaction with your own money first: deposit 10 birr, buy a card, cash out. Then tell your players.

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

## What was tested

I tested the game server automatically (26 checks, including two players claiming BINGO at the same moment, duplicate payment messages, cash-outs, and the server restarting in the middle of auto-calling) and ran the finished website in a real browser through the whole player and owner journey with a pretend Chapa. I could **not** test the real MongoDB, real Chapa or real Render from here, because I cannot log in to them. Step 6 above is how you confirm those pieces work, using pretend money, before any real money is involved.
