import webpush from 'web-push';

const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
];

function validSubscription(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const url = new URL(value.endpoint);
    return url.protocol === 'https:' &&
      ALLOWED_PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) &&
      typeof value.keys?.p256dh === 'string' && value.keys.p256dh.length >= 40 &&
      typeof value.keys?.auth === 'string' && value.keys.auth.length >= 16;
  } catch {
    return false;
  }
}

export function createPushService({ repo, config }) {
  const notificationGameKeys = ['bingoEnabled', 'kenoEnabled', 'aviatorEnabled', 'minesEnabled', 'carRacingEnabled'];
  async function notificationsAllowed() {
    const settings = await repo.getGameHubSettings();
    if (settings.generalEnabled === false || settings.bingoEnabled === false) return false;
    return !notificationGameKeys.every((key) => settings[key] === false);
  }

  const enabled = Boolean(config.pushVapidPublicKey && config.pushVapidPrivateKey && config.pushVapidSubject);
  if (enabled) {
    webpush.setVapidDetails(config.pushVapidSubject, config.pushVapidPublicKey, config.pushVapidPrivateKey);
  }

  return {
    isEnabled: () => enabled,
    getPublicKey: () => enabled ? config.pushVapidPublicKey : null,

    async saveSubscription(userId, subscription) {
      if (!enabled) throw new Error('Web Push is not configured');
      if (!validSubscription(subscription)) throw new Error('Invalid push subscription');
      await repo.savePushSubscription(userId, {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ?? null,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      });
    },

    async removeSubscription(userId, endpoint) {
      if (typeof endpoint !== 'string' || endpoint.length > 4096) return;
      await repo.removePushSubscription(userId, endpoint);
    },

    async notifyPlayers({ title, body, tag }) {
      if (!enabled) return { sent: 0, failed: 0, disabled: true };
      if (!(await notificationsAllowed())) return { sent: 0, failed: 0, disabled: true, suppressed: true };
      const subscriptions = await repo.listPushSubscriptions();
      const results = await Promise.allSettled(subscriptions.map(async (item) => {
        try {
          if (!(await notificationsAllowed())) return false;
          await webpush.sendNotification(item.subscription, JSON.stringify({
            title: String(title).slice(0, 80),
            body: String(body).slice(0, 240),
            tag: String(tag ?? 'black-gold-bingo').slice(0, 100),
            url: '/',
          }), { TTL: 0, urgency: 'high' });
          return true;
        } catch (error) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await repo.removePushSubscription(item.userId, item.endpoint);
          }
          throw error;
        }
      }));
      return {
        sent: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        disabled: false,
      };
    },
  };
}
