# Black Gold PLC Games Center

## Scope and safety

Keno and Aviator are separate game modules that can use the existing Bingo `users.balance` wallet. In development and automated tests, new rounds use the shared balance and write their debit/prize entries to the existing atomic `ledger` collection with unique `games:*` references. In production, this is deliberately opt-in through `GAMES_HUB_SHARED_WALLET_ENABLED`; the Render Blueprint defaults it to `false` so an unaudited existing Bingo balance cannot accidentally be wagered. Enabling it in production also requires `LOTTERY_LICENSE_APPROVED=true` and `CHAPA_MERCHANT_APPROVED=true`. Before enabling it, the owner must audit and reconcile existing player balances and confirm the approved business model. No legal approval or real-money activation is implied by this code change.

Rounds created before the shared-wallet change have no `walletMode` field. To avoid changing an already-open round or converting free demo credits into the Bingo balance, those legacy rounds finish against their original `gameHubWallets` / `gameHubLedger` records. Production rounds are always created on the separate non-withdrawable demo wallet in this simulation-only implementation, even if the shared-wallet flag is mistakenly set to `true`. Keno and Aviator are still simulation-only: the production player API also fails closed if either `REAL_MONEY_ENABLED=true` or `GAMES_HUB_SHARED_WALLET_ENABLED=true`, preventing demo-labelled bets from spending real Bingo balances. The shared-wallet flag is therefore a development/test integration switch today, not a production launch switch. Existing demo-wallet records are retained; they are not transferred or deleted.

The existing Bingo round engine, card collection, card signing, and settlement rules remain unchanged. Games Center round and settings records remain in `gameHubRounds`, `gameHubState`, and `gameHubSettings`. Shared-wallet money movements are recorded in the existing `ledger`; legacy `gameHubWallets` and `gameHubLedger` remain available for old rounds and production demo mode until safe activation. The in-memory repository mirrors the same behavior for tests. Completed game rounds are retained for 30 days in MongoDB and then removed automatically by a TTL index.

## Profit and payout controls across the three games

- **Bingo:** the existing default `PRIZE_PERCENT=80` allocates 80% of the eligible round pot to the prize calculation; the remaining nominal 20% is the operator share before operating costs and any other liabilities. The existing Bingo Admin prize-schedule controls support revenue-percent, fixed-prize and per-player modes, plus a prize cap. Bonus/fixed prize arrangements can differ from the 80/20 default. This PR does not change those rules.
- **Keno:** the existing payout table determines relative ticket weights, but a round-level pool settlement scales aggregate payouts down when needed so the total never exceeds the configured 40%–50% player pool. Admin Games controls the company commission from 50% to 60%.
- **Aviator:** the existing crash-point formula remains unchanged. Cash Out records the server-accepted multiplier immediately; wallet credits are deferred until the round crashes, then the available 40%–50% player pool is allocated proportionally by stake × recorded multiplier. Each bet is capped at ETB 20,000.
- **Important:** house edge is a long-run mathematical expectation, not guaranteed company profit. Actual results, payment costs, fraud, bonus funding and legal obligations affect operating profit.

## Keno

- Numbers available: 1–80.
- A player selects 1–10 unique numbers.
- Each round accepts entries for the configured betting window (default 20 seconds).
- Exactly 20 unique numbers are drawn.
- Stake and prize values are stored in integer santim.
- A fixed payout table is defined in `deploy/src/services/gamesHubService.js`; the table is not editable from the Admin UI.
- Every Keno ticket payout is capped server-side at ETB 20,000. Total Keno payouts in a round are also limited to the configured player-pool share of collected stakes.
- The round stores the seed commitment before betting and reveals the seed after settlement.

The draw uses a deterministic Fisher–Yates selection. For counter values 0, 1, 2, …, it computes HMAC-SHA256 with the revealed seed as the key and the message `keno:<counter>`. The first 32-bit unsigned word is rejection-sampled to avoid modulo bias, then used to select and swap an element from the remaining 1–80 pool. The first 20 selected values are the draw.

## Aviator

- Players place one simulation-credit bet during the betting window (default 8 seconds), using the same shared wallet as Bingo and Keno.
- The round changes to flight on the server.
- The displayed multiplier is an animation derived from the server start time; the server remains authoritative for Cash Out.
- Cash Out is accepted only while the round is flying and the server timestamp is strictly earlier than the server crash timestamp.
- Remaining active bets are marked lost when the round crashes.
- A bet can be paid only once; the cash-out ledger reference is unique and the bet transition is guarded by a database transaction.
- Every Aviator bet payout is capped server-side at ETB 20,000. Cash Out only records the multiplier; the round pool is distributed after crash, within the configured player-pool share of collected stakes.

Fairness commitment:
1. The server creates a cryptographically random 32-byte seed and publishes its SHA-256 hash before betting.
2. The crash value is derived from the first 52 bits of HMAC-SHA256 using the secret seed as the key and `aviator-crash-v1` as the domain-separated message: `u = value / 2^52`. The public SHA-256 commitment alone does not reveal the crash result.
3. The crash multiplier is `min(1000, max(1, floor((0.99 / (1 - u)) * 100) / 100))`.
4. The seed is revealed after the round crashes so the commitment and crash value can be independently checked.

The flight multiplier grows as `exp(elapsedMilliseconds * 0.00007)`, rounded down to two decimal places. The browser animation is only a display; the server checks the actual time and round state when processing Cash Out.

## Admin controls

The Admin Games panel can enable/disable each game, set stake limits and betting windows, and choose a whole-number company commission/house edge from 50% to 60%. The ETB 20,000 per-ticket/per-bet payout ceiling is enforced server-side. The payout schedule and fairness algorithms remain fixed.

The player can switch directly between Bingo, Keno and Aviator from the in-game quick navigation; the existing bottom navigation and Games Center remain available too.

### Keno payout-table return audit

Keno's existing table is used only to determine relative prize weights. If aggregate raw prizes exceed the round pool budget, all ticket prizes are proportionally scaled so that total paid never exceeds 40%–50% of collected stakes. The configured company share is therefore protected at 50%–60% before operating costs:

| Admin commission | Maximum player pool |
|---:|---:|
| 1 | 12.50% |
| 2 | 13.92% |
| 3 | 47.27% |
| 4 | 50.99% |
| 5 | 41.87% |
| 6 | 29.34% |
| 7 | 41.93% |
| 8 | 30.70% |
| 9 | 35.88% |
| 10 | 41.48% |

The commission setting is visible in Admin. If raw table payouts are lower than the player-pool ceiling, the unused amount remains undistributed, so actual operator retention may exceed the configured minimum.

### Risk-cap boundary

The round pool itself is the aggregate cap: Keno and Aviator payouts cannot exceed the player-pool percentage of that round's collected stakes. Each individual Keno ticket/Aviator bet is additionally capped at ETB 20,000.

## Verification

The automated suite includes service tests for:
- Keno selection validation, idempotent entry requests, shared-wallet debit/credit, common ledger references, deterministic draw length and settlement.
- Aviator seed commitment, server-side round transition, shared-wallet debit, deferred Cash Out recording, atomic pool settlement credit and crash reveal.
- Admin setting validation.
- The production real-money guard.

Run with:

```sh
cd deploy
npm test
```

The regular deployment workflow also runs the frontend TypeScript check, frontend production build, and backend test suite. Production shared-wallet activation is intentionally disabled by default; set `GAMES_HUB_SHARED_WALLET_ENABLED=true` only after the database balance audit and the two written approvals described above. A green GitHub workflow does not prove that the Render deployment or MongoDB production environment is live; those must be checked separately.
