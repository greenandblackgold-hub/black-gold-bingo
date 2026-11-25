import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createPushService } from '../src/services/pushService.js';

test('push subscriptions are stored per player and removable without touching wallet data', async () => {
  const repo = createMemoryRepo();
  await repo.init();
  const player = await repo.createUser({ phone: '0912345678', name: 'Player', pinHash: 'hash' });
  const keys = webpush.generateVAPIDKeys();
  const push = createPushService({
    repo,
    config: { pushVapidPublicKey: keys.publicKey, pushVapidPrivateKey: keys.privateKey, pushVapidSubject: 'mailto:test@example.com' },
  });
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    expirationTime: null,
    keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(24) },
  };

  assert.equal(push.isEnabled(), true);
  assert.equal(push.getPublicKey(), keys.publicKey);
  await push.saveSubscription(player.id, subscription);
  const saved = await repo.listPushSubscriptions();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, player.id);
  assert.equal(saved[0].subscription.endpoint, subscription.endpoint);
  await push.removeSubscription(player.id, subscription.endpoint);
  assert.equal((await repo.listPushSubscriptions()).length, 0);
  assert.equal((await repo.findUserById(player.id)).balance, 0);
  await repo.close();
});

test('push subscriptions reject non-HTTPS and untrusted push endpoints', async () => {
  const repo = createMemoryRepo();
  await repo.init();
  const keys = webpush.generateVAPIDKeys();
  const push = createPushService({
    repo,
    config: { pushVapidPublicKey: keys.publicKey, pushVapidPrivateKey: keys.privateKey, pushVapidSubject: 'mailto:test@example.com' },
  });
  await assert.rejects(() => push.saveSubscription('player', {
    endpoint: 'https://attacker.example/collect',
    keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(24) },
  }), /Invalid push subscription/);
  await repo.close();
});


test('player notifications are suppressed when Bingo is OFF or all games are OFF', async () => {
  const repo = createMemoryRepo();
  await repo.init();
  const keys = webpush.generateVAPIDKeys();
  const push = createPushService({ repo, config: { pushVapidPublicKey: keys.publicKey, pushVapidPrivateKey: keys.privateKey, pushVapidSubject: 'mailto:test@example.com' } });
  await repo.updateGameHubSettings({ generalEnabled: true, bingoEnabled: false, kenoEnabled: true, aviatorEnabled: true, minesEnabled: true, carRacingEnabled: true });
  const bingoOff = await push.notifyPlayers({ title: 'test', body: 'must not send' });
  assert.equal(bingoOff.suppressed, true);
  assert.equal(bingoOff.sent, 0);
  await repo.updateGameHubSettings({ generalEnabled: true, bingoEnabled: false, kenoEnabled: false, aviatorEnabled: false, minesEnabled: false, carRacingEnabled: false });
  const allOff = await push.notifyPlayers({ title: 'test', body: 'must not send' });
  assert.equal(allOff.suppressed, true);
  assert.equal(allOff.sent, 0);
  await repo.close();
});
