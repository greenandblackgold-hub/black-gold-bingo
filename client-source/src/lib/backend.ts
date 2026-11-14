/**
 * src/lib/backend.ts
 *
 * Where the shared game lives, and who is allowed to change it.
 *
 *  - Hosted page (window.claude present): game state is a shared document that
 *    ONLY the page owner can write (enforced by the store's access rules, not by
 *    this file). Players read it live and send claims.
 *  - Standalone / dev (no window.claude): a single-browser demo. Tabs of the same
 *    browser sync through localStorage. It is NOT secure: anyone can open #host.
 */
import type { Claim, GameBackend, SharedGame } from '@/types/game';

/* Minimal shapes of the hosting runtime's db and user capabilities. */
interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface QuerySnap {
  docs: DocSnap[];
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: DocSnap) => void, error?: (e: unknown) => void): () => void;
}
interface CollRef {
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: unknown) => void): () => void;
}
interface DbNs {
  doc(path: string): DocRef;
  collection(path: string): CollRef;
}
interface UserNs {
  isOwner(): Promise<boolean>;
  id(): Promise<string | null>;
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

/* ───────────────────────────── (de)serialization ───────────────────────────── */

export const DEFAULT_GAME: SharedGame = {
  phase: 'waiting',
  winPattern: 'any_line',
  roundNumber: 1,
  calledNumbers: [],
  autoCall: false,
  callIntervalSec: 5,
  nextCallAt: null,
  winner: null,
};

function parseGame(raw: unknown): SharedGame | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Record<keyof SharedGame, unknown>>;
  const w = r.winner as { cardId?: unknown; serial?: unknown; at?: unknown } | null | undefined;
  return {
    phase: r.phase === 'running' || r.phase === 'ended' ? r.phase : 'waiting',
    winPattern: typeof r.winPattern === 'string' && ['any_line','horizontal_line','vertical_line','diagonal','two_lines','two_horizontal_lines','four_corners','rectangle','two_rectangles','half_house','full_house','x','t','l','plus','diamond','picture_frame','six_pack','postage_stamp'].includes(r.winPattern) ? r.winPattern as import('@/types/game').WinPattern : 'any_line',
    roundNumber: typeof r.roundNumber === 'number' ? r.roundNumber : 1,
    calledNumbers: Array.isArray(r.calledNumbers) ? r.calledNumbers.filter((n): n is number => typeof n === 'number') : [],
    autoCall: r.autoCall === true,
    callIntervalSec: typeof r.callIntervalSec === 'number' ? r.callIntervalSec : 5,
    nextCallAt: typeof r.nextCallAt === 'number' ? r.nextCallAt : null,
    winner:
      w && typeof w.cardId === 'string' && (typeof w.serial === 'string' || typeof w.serial === 'number')
        ? { cardId: w.cardId, serial: w.serial, at: typeof w.at === 'number' ? w.at : 0 }
        : null,
  };
}

function parseClaim(id: string, raw: unknown): Claim | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.cardId !== 'string' || typeof r.round !== 'number') return null;
  if (typeof r.serial !== 'string' && typeof r.serial !== 'number') return null;
  return {
    id,
    cardId: r.cardId,
    serial: r.serial,
    grid: r.grid as Claim['grid'],
    round: r.round,
    at: typeof r.at === 'number' ? r.at : 0,
  };
}

const toRecord = (g: SharedGame): Record<string, unknown> => ({ ...g });

/* ───────────────────────────── hosted (shared db) ───────────────────────────── */

function createArtifactBackend(db: DbNs, canHost: boolean, uid: string | null): GameBackend {
  const gameDoc = () => db.doc('game/state');
  return {
    kind: 'artifact',
    canHost,
    subscribeGame: (cb) =>
      gameDoc().onSnapshot(
        (snap) => cb(snap.exists ? parseGame(snap.data()) : null),
        () => cb(null),
      ),
    saveGame: async (game) => {
      if (!canHost) throw new Error('Only the host can change the game');
      await gameDoc().set(toRecord(game));
    },
    submitClaim: async (claim) => {
      if (!uid) throw new Error('Not signed in');
      await db.doc(`claims/${uid}`).set({ ...claim });
    },
    subscribeClaims: (cb) => {
      if (!canHost) return () => undefined;
      return db.collection('claims').onSnapshot(
        (snap) => cb(snap.docs.map((d) => parseClaim(d.id, d.data())).filter((c): c is Claim => c !== null)),
        () => cb([]),
      );
    },
    removeClaim: async (id) => {
      if (canHost) await db.doc(`claims/${id}`).delete();
    },
    clearClaims: async () => {
      if (!canHost) return;
      const snap = await new Promise<QuerySnap>((resolve) => {
        const off = db.collection('claims').onSnapshot(
          (s) => {
            off();
            resolve(s);
          },
          () => resolve({ docs: [] }),
        );
      });
      await Promise.all(snap.docs.map((d) => db.doc(`claims/${d.id}`).delete()));
    },
  };
}

/* ───────────────────────────── standalone demo (localStorage) ───────────────────────────── */

const GAME_KEY = 'bgb.game';
const CLAIMS_KEY = 'bgb.claims';
const PID_KEY = 'bgb.pid';

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function createLocalBackend(): GameBackend {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  const subscribe = (key: string, emit: () => void) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) emit();
    };
    listeners.add(emit);
    window.addEventListener('storage', onStorage);
    emit();
    return () => {
      listeners.delete(emit);
      window.removeEventListener('storage', onStorage);
    };
  };
  const readClaims = (): Record<string, unknown> => {
    const v = readJson(CLAIMS_KEY);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  };
  let pid = localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = `p-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(PID_KEY, pid);
    } catch {
      /* ignore */
    }
  }
  const playerId = pid;

  return {
    kind: 'local',
    canHost: true,
    subscribeGame: (cb) => subscribe(GAME_KEY, () => cb(parseGame(readJson(GAME_KEY)))),
    saveGame: async (game) => {
      localStorage.setItem(GAME_KEY, JSON.stringify(game));
      notify();
    },
    submitClaim: async (claim) => {
      const all = readClaims();
      all[playerId] = { ...claim };
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(all));
      notify();
    },
    subscribeClaims: (cb) =>
      subscribe(CLAIMS_KEY, () =>
        cb(
          Object.entries(readClaims())
            .map(([id, v]) => parseClaim(id, v))
            .filter((c): c is Claim => c !== null),
        ),
      ),
    removeClaim: async (id) => {
      const all = readClaims();
      delete all[id];
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(all));
      notify();
    },
    clearClaims: async () => {
      localStorage.removeItem(CLAIMS_KEY);
      notify();
    },
  };
}

/* ───────────────────────────── no shared store for this viewer ───────────────────────────── */

function createUnavailableBackend(): GameBackend {
  const none = () => () => undefined;
  const refuse = async () => {
    throw new Error('Shared game unavailable');
  };
  return {
    kind: 'unavailable',
    canHost: false,
    subscribeGame: (cb) => {
      cb(null);
      return none();
    },
    saveGame: refuse,
    submitClaim: refuse,
    subscribeClaims: none,
    removeClaim: refuse,
    clearClaims: refuse,
  };
}

/* ───────────────────────────── entry point ───────────────────────────── */

export async function createBackend(): Promise<GameBackend> {
  const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!rt || typeof rt.use !== 'function') return createLocalBackend();

  const [db, user] = (await Promise.all([rt.use('db'), rt.use('user')])) as [DbNs | null, UserNs | null];
  if (!db) return createUnavailableBackend();

  let isOwner = false;
  let uid: string | null = null;
  try {
    isOwner = user ? await user.isOwner() : false;
    uid = user ? await user.id() : null;
  } catch {
    /* treat as a regular player */
  }
  return createArtifactBackend(db, isOwner, uid);
}
