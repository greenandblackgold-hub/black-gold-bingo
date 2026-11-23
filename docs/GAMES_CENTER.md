# Black Gold PLC Games Center

## Scope and safety

Keno and Aviator are separate game modules that use the same authenticated player account and the existing Bingo `users.balance` wallet. New Keno and Aviator rounds debit stakes and credit prizes through the existing atomic `ledger` collection, using unique `games:*` references. The same balance is visible to Bingo, Keno, Aviator, and the existing wallet screen. These balances remain simulation ETB credits while real-money activity is disabled; this change does not authorize, activate, or implement real-money gambling, deposits, withdrawals, or cash prizes.

Rounds created before the shared-wallet change have no `walletMode` field. To avoid changing an already-open round or converting free demo credits into the Bingo balance, those legacy rounds finish against their original `gameHubWallets` / `gameHubLedger` records. Every newly created round is marked `walletMode: shared` and uses the common Bingo wallet. Existing demo-wallet records are retained; they are not transferred or deleted.

The existing Bingo round engine, card collection, card signing, and settlement rules remain unchanged. Games Center round and settings records remain in `gameHubRounds`, `gameHubState`, and `gameHubSettings`. New game money movements are recorded in the existing shared `ledger`; the legacy `gameHubWallets` and `gameHubLedger` collections remain only to finish pre-existing demo rounds safely. The in-memory repository mirrors the same behavior for tests. Completed game rounds are retained for 30 days in MongoDB and then removed automatically by a TTL index.

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

- Players place one simulation-credit bet during the betting window (default 8 seconds), using the same shared wallet as Bingo and Keno.
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
- Keno selection validation, idempotent entry requests, shared-wallet debit/credit, common ledger references, deterministic draw length and settlement.
- Aviator seed commitment, server-side round transition, shared-wallet debit/cash-out credit and crash reveal.
- Admin setting validation.
- The production real-money guard.

Run with:

```sh
cd deploy
npm test
```

The regular deployment workflow also runs the frontend TypeScript check, frontend production build, and backend test suite. A green GitHub workflow does not prove that the Render deployment or MongoDB production environment is live; those must be checked separately.
