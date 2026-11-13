# Architecture

```
Browser (React)                    API (Node, one process)                    MongoDB Atlas
  Play / Wallet / Verify  ──REST──▶  auth · game · wallet services  ──────▶  users, cards, game,
  Control Center (#host)  ◀──SSE───  live game state                          ledger, payments,
                                     auto-call scheduler                      withdrawals, rounds
                                        │
                                        └──HTTPS──▶ Chapa (checkout, verify, transfers)
                                        ◀──webhook── Chapa
```

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

Public: `GET /health`, `GET /api/game`, `GET /api/stream` (SSE), `POST /api/auth/register`, `POST /api/auth/login`, `GET|POST /api/payments/chapa/callback|webhook`.

Signed-in player (Bearer token): `GET /api/me`, `GET /api/cards`, `POST /api/cards/buy {count}`, `POST /api/claim {cardId}`, `POST /api/verify {cardId}`, `GET /api/ledger`, `POST /api/payments/deposit {amount}`, `GET /api/payments/status/:txRef`, `GET /api/banks`, `GET|POST /api/withdrawals`.

Admin only (role checked against the database on every request, not trusted from the token): `POST /api/admin/round/start|end|reset`, `POST /api/admin/draw`, `POST /api/admin/auto {on, intervalSec}`, `GET /api/admin/stats`, `GET /api/admin/withdrawals?status=`, `POST /api/admin/withdrawals/:id/approve|reject|refresh`.

Protections: scrypt-hashed PINs, 5 failed logins lock an account for 15 minutes, HS256 tokens valid 7 days, per-IP rate limits (configurable), CORS allow-list, 64 KB body limit, `nosniff` and `no-store` headers, constant-time signature checks.

## Money flows

**Deposit.** `POST /payments/deposit` stores a pending payment and asks Chapa for a checkout link; the player pays on Chapa; Chapa redirects back (`/?tx_ref=...#wallet`) and also calls the webhook and callback. All three paths run the same `confirmDeposit`: the server calls Chapa's verify endpoint and credits the wallet only if status is success, currency is ETB and the amount equals what was recorded.

**Buying cards.** One transaction: check the round is still `waiting`, debit the player, insert the ledger row, insert the cards, add to the pot.

**Winning.** `POST /claim`: the server loads the card from its own database, checks signature and ownership, checks a complete line against the called numbers, then in one transaction ends the round with this winner and credits `floor(pot × PRIZE_PERCENT / 100)` under reference `prize:<round>`. A second claimant finds the round already ended.

**Cash-out.** Request: debit (hold) plus a `pending` withdrawal in one transaction. Approval: `pending → processing`, then Chapa transfer; success marks `paid`, failure marks `failed` and refunds once, an errored request leaves `processing` for you to resolve with **Check status**. Rejection refunds once.

## Switching storage

`STORAGE=mongo` (automatic when `MONGODB_URI` is set) uses `src/db/mongoRepo.js`; `STORAGE=memory` uses `memoryRepo.js` (tests and local sandbox). Both implement the same methods, and the same test suite runs against either (`TEST_MONGODB_URI`). To use Firebase/Postgres instead, implement the same repository methods; the services and HTTP layer do not change. Note the transactional guarantees above must be preserved.

## Website modes

The website is prebuilt into `deploy/public/index.html` and served by the same Node process as the API (same address, so no cross-site settings). It runs in server mode because it was built with `VITE_SERVER_MODE=true`. Built without it (and without `VITE_API_URL`), the website runs as the original in-browser demo with no accounts and no real money. Source code is in `client-source/`.
