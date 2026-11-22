# Black Gold PLC Games Center

## Scope and safety

Keno and Aviator are separate game modules. They use the existing authenticated player account and a separate **Games Demo Wallet** shared by Keno and Aviator. This wallet starts with 1,000 demo ETB credits per player and is stored separately from the existing Bingo wallet and withdrawal ledger. It is non-withdrawable, cannot be transferred, and cannot be converted to cash. This separation is intentional because the existing manual withdrawal workflow can pay the main wallet; simulation credits must never enter that balance. The service also rejects these games in production if the legacy real-money flag is enabled. This does not approve, activate, or implement real-money gambling, deposits, withdrawals, or cash prizes.

The existing Bingo engine, Bingo round document, card collection, card signing, Bingo wallet, and Bingo settlement paths are not changed by the Games Center. New game records live in the separate `gameHubRounds`, `gameHubState`, `gameHubSettings`, `gameHubWallets`, and `gameHubLedger` MongoDB collections. The in-memory repository implements the same additive methods for tests. Completed game rounds are retained for 30 days in MongoDB and then removed automatically by a TTL index.

## Keno

- Numbers available: 1–80.
- A player selects 1–10 unique numbers.
- Each round accepts entries for the configured betting window (default 20 seconds).
- Exactly 20 unique numbers are drawn.
- Stake and prize values are stored in integer santim.
- A fixed payout table is defined in `deploy/src/services/gamesHubService.js`; the table is not editable from the Admin UI.
- The round stores the seed commitment before betting and reveals the seed after settlement.

The draw uses a deterministic Fisher–Yates selection. For counter values 0, 1, 2, …, it computes HMAC-SHA256 with the revealed seed as the key and the message `keno:<counter>`. The first 32-bit unsigned word is rejection-sampled to avoid modulo bias, then used to select and swap an element from the remaining 1–80 pool. The first 20 selected values are the draw.

## Aviator

- Players place one simulation-credit bet during the betting window (default 8 seconds).
- The round changes to flight on the server.
- The displayed multiplier is an animation derived from the server start time; the server remains authoritative for Cash Out.
- Cash Out is accepted only while the round is flying and the server timestamp is strictly earlier than the server crash timestamp.
- Remaining active bets are marked lost when the round crashes.
- A bet can be paid only once; the cash-out ledger reference is unique and the bet transition is guarded by a database transaction.

Fairness commitment:
1. The server creates a cryptographically random 32-byte seed and publishes its SHA-256 hash before betting.
2. The crash value is derived from the first 52 bits of HMAC-SHA256 using the secret seed as the key and `aviator-crash-v1` as the domain-separated message: `u = value / 2^52`. The public SHA-256 commitment alone does not reveal the crash result.
3. The crash multiplier is `min(1000, max(1, floor((0.99 / (1 - u)) * 100) / 100))`.
4. The seed is revealed after the round crashes so the commitment and crash value can be independently checked.

The flight multiplier grows as `exp(elapsedMilliseconds * 0.00007)`, rounded down to two decimal places. The browser animation is only a display; the server checks the actual time and round state when processing Cash Out.

## Admin controls

The Admin Games panel can enable/disable each game and set the minimum/maximum demo stake and betting windows. It cannot alter the payout table, crash formula, or a running round's committed result.

## Verification

The automated suite includes service tests for:
- Keno selection validation, idempotent entry requests, wallet debit, deterministic draw length and settlement.
- Aviator seed commitment, server-side round transition, cash-out and crash reveal.
- Admin setting validation.
- The production real-money guard.

Run with:

```sh
cd deploy
npm test
```

The regular deployment workflow also runs the frontend TypeScript check, frontend production build, and backend test suite. A green GitHub workflow does not prove that the Render deployment or MongoDB production environment is live; those must be checked separately.
