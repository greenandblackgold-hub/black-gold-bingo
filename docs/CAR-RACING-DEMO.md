# Multiplayer Car Racing — Demo/Simulation

This feature is deliberately isolated from Bingo, Keno, Aviator, Mines, the production Wallet, MongoDB collections, SMS Bridge, Host/Admin controls and Chapa.

## Demo-only guarantees

- The game remains simulation-only in every environment. It is available on the existing production service only while `REAL_MONEY_ENABLED=false`; if real-money play is enabled, Car Racing is blocked server-side and hidden. It never changes lottery-license or Chapa-approval flags.
- Each authenticated demo player receives an isolated in-memory balance of 1,000 simulation ETB. These credits are not read from or written to the existing Wallet or ledger.
- Room entry fees are 5–500 simulation ETB. Rooms support 2–8 players.
- The server owns race progress, speed, track hazards, finish order and settlement. The client sends only throttle/steering input; it cannot submit a result or payout.
- Settlement is a single synchronous server-side operation: 55% company share, 45% prize pool, with a maximum demo payout of ETB 20,000.
- Rooms, demo balances and race history are in process memory and reset when the demo server restarts. This is a single-server simulation, not a horizontally scaled production multiplayer service.
- No real-money deposit, withdrawal, cash-out, wallet debit, Chapa call or production prize transfer exists in this module.

## Gameplay

1. Sign in to the existing simulation-mode service with two or more separate player accounts.
2. Open Games Center → Multiplayer Car Racing.
3. One player creates a room and chooses an entry-credit amount; other players join with the six-character room code or the open-room list.
4. Each driver selects a car and marks ready. The race begins after every player is ready (minimum two).
5. Hold throttle and steer left/right on each phone. The server calculates progress and track penalties.
6. The first server-calculated finisher wins the 45% simulation pool; the company share is displayed separately.

## Local verification

From the repository root:

```sh
npm --prefix deploy test
npm --prefix client-source run typecheck
npm --prefix client-source run build
```

Run the API in a non-production environment with memory storage for isolated demo play. Never enable this simulation by changing production legal/payment approval flags.
## Host and General availability

Car Racing uses the existing Games Hub settings record (no database schema migration). The Host switch `carRacingEnabled` defaults ON and is managed from the Host Games panel under Bingo controls. The existing General Games Center switch is also enforced. Both switches must be ON for the Car Racing card and every Car Racing API action to be available. Turning either switch OFF immediately blocks the catalog, lobby, room, car selection, ready, control and leave endpoints. Real-money mode always keeps this demo unavailable regardless of the Host switch; production simulation mode can use it safely.
