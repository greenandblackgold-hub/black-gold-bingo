# Architecture

```
Browser (React)                    API (Node, one process)                    MongoDB Atlas
  Play / Wallet / Verify  ──REST──▶  auth · game · wallet services  ──────▶  users, cards, game,
  Control Center (#host)  ◀──SSE───  live game state                          ledger, payments,
                                     auto-call scheduler                      withdrawals, rounds
                                        │
                                        └──HTTPS──▶ Chapa (real-money integration; gated off in current production)
                                        ◀──webhook── Chapa (ignored while real-money mode is off)
```

## Current production mode

The connected Render service is currently **simulation-only**:

- `REAL_MONEY_ENABLED=false`, `LOTTERY_LICENSE_APPROVED=false`, `CHAPA_MERCHANT_APPROVED=false`, and `AUTO_PAYOUT=false`.
- The player deposit flow is `POST /api/simulation/deposits`: amount + transaction reference creates a pending request.
- The trusted Admin-phone SMS Bridge (`/api/webhooks/sms/device`) or signed adapter (`/api/webhooks/sms`) can match receipt evidence. SMS never credits a wallet automatically.
- A signed-in Admin independently verifies the receipt and approves through `POST /api/admin/deposits/:txRef/approve`. Only that explicit approval credits simulation ETB.
- Cash-outs and payouts are unavailable. Simulation ETB has no cash value and cannot be withdrawn. Real-money Chapa and manual payout paths remain gated.

## Persistence: what survives a restart

Everything that matters is in MongoDB; the process keeps only timers and open connections.

| Data | Collection | Notes |
|---|---|---|
| Accounts, wallet balance (santim) | `users` | `balance` changes only through the ledger helper, inside a transaction |
| Every money movement | `ledger` | unique `ref` makes each movement idempotent |
| Current game | `game` (`_id: "state"`) | phase, round, called numbers, auto-call settings, `nextCallAt`, pot, winner, `version` |
| Finished rounds | `rounds` | called numbers and winner, so old cards can still be verified |
| Cards | `cards` | unique `code`, owner, round, grid, HMAC signature |
| Deposits | `payments` | `pending` to `success` exactly once |
| Cash-outs | `withdrawals` | `pending, processing, paid / rejected / failed` |

On restart the API reads the game document and calls `resume()`: if auto-call was on, the next draw happens at the stored `nextCallAt` (immediately if it is overdue). Browsers reconnect to the live stream automatically (EventSource) and receive the current state at once. A request that was in flight when the process died can be retried safely because every money step has a unique reference.

## Game state is updated with compare-and-set

Every change reads the game document and writes it back only if `version` is unchanged (`casGame`). Two simultaneous draws, starts or claims cannot both apply; the loser retries or gets a clear error. Buying cards and settling a win additionally run in a MongoDB transaction together with their ledger rows.

## HTTP API

Public: `GET /health`, `GET /api/game`, `GET /api/stream` (SSE), `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/webhooks/sms/device` (scoped Admin-device token), `POST /api/webhooks/sms` (signed adapter), and Chapa callbacks/webhooks (ignored while real-money mode is off).

Signed-in player (Bearer token): `GET /api/me`, `GET /api/cards`, `POST /api/cards/buy {count}`, `POST /api/claim {cardId}`, `POST /api/verify {cardId}`, `GET /api/ledger`, `POST /api/simulation/deposits`, `GET /api/simulation/deposits`, `GET /api/simulation/deposits/:txRef`, `GET /api/games/keno/state`, `POST /api/games/keno/bets`, `GET /api/games/keno/history`, `GET /api/games/aviator/state`, `POST /api/games/aviator/bets`, `POST /api/games/aviator/cashout`, and `GET /api/games/aviator/history`. Real-money deposit and withdrawal endpoints are gated; simulation withdrawal requests return 503 in production.

Admin only (role checked against the database on every request): `POST /api/admin/sms-device/token`, `GET /api/admin/deposits`, `POST /api/admin/deposits/:txRef/approve|reject`, game settings/round controls, and read-only withdrawal queues. Manual payout processing and simulation cash-out approval are blocked in production; rejection routes remain available to refund any legacy held request.

Protections: scrypt-hashed PINs, 5 failed logins lock an account for 15 minutes, HS256 tokens valid 7 days, per-IP rate limits (configurable), CORS allow-list, 64 KB body limit, `nosniff` and `no-store` headers, constant-time signature checks.

## Money flows

**Simulation deposit (current).** The player submits an amount and transaction reference. The API stores a pending request and leaves the wallet unchanged. The trusted Admin-phone SMS Bridge may parse and match the incoming bank/Telebirr notification, but that match is evidence only. An Admin independently verifies the receipt and explicitly approves the request; the ledger credits the simulation balance once. Duplicate SMS events and repeated approvals cannot double-credit.

**Real-money deposit (disabled).** `POST /api/payments/deposit` and Chapa callbacks/webhooks are retained for a future approved integration. The current production flags keep real-money checkout disabled.

**Buying cards.** One transaction: check the round is still `waiting`, debit the player, insert the ledger row, insert the cards, add to the pot.

**Winning.** `POST /api/claim`: the server loads the card from its own database, checks signature and ownership, checks the exact called-number snapshot and winning pattern, then atomically ends the round and credits `floor(pot × PRIZE_PERCENT / 100)` ETB to the winner's wallet ledger under a unique payout reference. The configured Bingo winner share is 45%; the remaining 55% is the nominal operator share before operating costs, provider fees and applicable taxes. In production this is simulation credit only; it is not withdrawable cash.

**Cash-outs.** Cash-outs are unavailable in the current simulation version. Simulation ETB cannot be withdrawn or paid out. Real-money Chapa withdrawals and manual external-reference payouts remain gated until the required real-money and licensing approvals are enabled. Any legacy pending withdrawal can be rejected to return its held balance.

## Switching storage

`STORAGE=mongo` (automatic when `MONGODB_URI` is set) uses `src/db/mongoRepo.js`; `STORAGE=memory` uses `memoryRepo.js` (tests and local sandbox). Both implement the same methods, and the same test suite runs against either (`TEST_MONGODB_URI`). To use Firebase/Postgres instead, implement the same repository methods; the services and HTTP layer do not change. Note the transactional guarantees above must be preserved.

## Website modes

The website is prebuilt into `deploy/public/index.html` and served by the same Node process as the API (same address, so no cross-site settings). It runs in server mode because it was built with `VITE_SERVER_MODE=true`. Built without it (and without `VITE_API_URL`), the website runs as the original in-browser demo with no accounts and no real money. Source code is in `client-source/`.
