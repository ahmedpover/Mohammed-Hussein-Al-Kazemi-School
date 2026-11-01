import { createECDH } from 'node:crypto';
const key=createECDH('prime256v1');key.generateKeys();
console.log('VAPID_PUBLIC_KEY='+key.getPublicKey().toString('base64url'));
console.log('VAPID_PRIVATE_KEY='+key.getPrivateKey().toString('base64url'));
console.log('VAPID_SUBJECT=mailto:admin@example.com');
console.log('Keep PRIVATE key secret. Replace subject email. Never commit real keys.');
