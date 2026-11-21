import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('Add these values to your Render service Environment:');
console.log(`PUSH_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`PUSH_VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('PUSH_VAPID_SUBJECT=mailto:YOUR-ADMIN-EMAIL');
console.log('\nKeep PUSH_VAPID_PRIVATE_KEY secret. Never commit it or share it publicly.');
