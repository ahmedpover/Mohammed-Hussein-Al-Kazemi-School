// Web Push using Node's built-in crypto (RFC 8291, RFC 8292).
import { createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto';
const decode = s => Buffer.from(s, 'base64url');
const encode = b => Buffer.from(b).toString('base64url');
const keys = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !/^mailto:|^https:\/\//.test(subject)) return null;
  const point = decode(publicKey);
  if (point.length !== 65 || point[0] !== 4 || decode(privateKey).length !== 32) return null;
  return {publicKey, privateKey, subject, point};
};
export const getPushPublicKey = () => keys()?.publicKey || null;
export function validSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false;
  let url;
  try { url = new URL(value.endpoint); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) return false;
  // Avoid accepting arbitrary endpoints (and server-side request forgery).
  if (!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','push.services.mozilla.com'].includes(url.hostname) && !url.hostname.endsWith('.push.apple.com') && !url.hostname.endsWith('.notify.windows.com')) return false;
  return typeof value.keys?.p256dh === 'string' && decode(value.keys.p256dh).length === 65 && typeof value.keys?.auth === 'string' && decode(value.keys.auth).length === 16;
}
function derive(payload, subscription) {
  const receiver = decode(subscription.keys.p256dh);
  const auth = decode(subscription.keys.auth);
  const sender = createECDH('prime256v1'); sender.generateKeys();
  const senderPub = sender.getPublicKey();
  const shared = sender.computeSecret(receiver);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), receiver, senderPub]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, info, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const { createCipheriv } = requireCrypto;
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const content = Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([2])]);
  if (content.length > 3800) throw new Error('Push payload too long');
  const encrypted = Buffer.concat([cipher.update(content), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(5); header.writeUInt32BE(4096, 0); header.writeUInt8(senderPub.length, 4);
  return Buffer.concat([salt, header, senderPub, encrypted]);
}
import * as requireCrypto from 'node:crypto';
export async function sendWebPush(subscription, payload) {
  const config = keys(); if (!config) return { disabled: true };
  const endpoint = new URL(subscription.endpoint);
  if (!validSubscription(subscription)) throw new Error('Invalid push subscription');
  const now = Math.floor(Date.now()/1000);
  const header = encode(JSON.stringify({typ:'JWT',alg:'ES256'}));
  const claim = encode(JSON.stringify({aud:endpoint.origin,exp:now+3600,sub:config.subject}));
  const unsigned = `${header}.${claim}`;
  const jwk = {kty:'EC',crv:'P-256',x:encode(config.point.subarray(1,33)),y:encode(config.point.subarray(33,65)),d:config.privateKey};
  const signature = sign('sha256', Buffer.from(unsigned), {key:createPrivateKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'});
  const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm','TTL':'86400','Authorization':`vapid t=${unsigned}.${encode(signature)}, k=${config.publicKey}`},body:derive(payload,subscription),signal:AbortSignal.timeout(10000),redirect:'error'});
  return {status:response.status,ok:response.ok,gone:response.status===404||response.status===410};
}
