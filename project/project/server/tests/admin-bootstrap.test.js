import test from 'node:test';
import assert from 'node:assert/strict';
import { adminConfigs, provisionAdmins } from '../admin-bootstrap.js';

const strongPassword = 'strong-password-example-123';
const env = {
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_NAME: 'أحمد',
  ADMIN_PASSWORD: strongPassword,
  ADMIN2_EMAIL: 'second@example.com',
  ADMIN2_NAME: 'مدير المدرسة',
  ADMIN2_PASSWORD: 'different-strong-password-456'
};
const silentLogger = { log() {} };
function database(seed = []) {
  const users = new Map(seed.map(row => [row.email, { ...row }]));
  const sessions = new Map(seed.map(row => [row.id, ['session-a']]));
  const queries = [];
  return {
    users, sessions, queries,
    async query(sql, args) {
      queries.push([sql, args]);
      if (sql.startsWith('SELECT id,role,password_hash FROM users')) return { rows: users.has(args[0]) ? [users.get(args[0])] : [] };
      if (sql.startsWith('INSERT INTO users')) { const [id,email,name,password_hash,role] = args; users.set(email, { id,email,name,password_hash,role }); return { rows: [] }; }
      if (sql.startsWith('UPDATE users SET password_hash')) { const [password_hash,id] = args; for (const u of users.values()) if (u.id === id) u.password_hash = password_hash; return { rows: [] }; }
      if (sql.startsWith('DELETE FROM sessions')) { sessions.delete(args[0]); return { rows: [] }; }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}
function deps(db, config = env) {
  let next = 0;
  return {
    env: config,
    query: db.query,
    id: () => `id-${++next}`,
    hash: async value => `hash:${value}`,
    verify: async (value, stored) => stored === `hash:${value}`,
    logger: silentLogger
  };
}

test('existing ADMIN_* and ADMIN2_* become independent full administrators', async () => {
  const db = database();
  await provisionAdmins(deps(db));
  assert.equal(db.users.size, 2);
  assert.equal(db.users.get('admin@example.com').role, 'admin');
  assert.equal(db.users.get('second@example.com').role, 'admin');
  assert.equal(db.users.get('second@example.com').name, 'مدير المدرسة');
  assert.notEqual(db.users.get('admin@example.com').password_hash, db.users.get('second@example.com').password_hash);
  const previous = db.queries.length;
  await provisionAdmins(deps(db));
  assert.equal(db.queries.slice(previous).filter(([sql]) => sql.startsWith('UPDATE') || sql.startsWith('DELETE') || sql.startsWith('INSERT')).length, 0);
});

test('password rotation revokes only the changed administrator sessions', async () => {
  const db = database();
  await provisionAdmins(deps(db));
  db.sessions.set('id-1', ['first-session']);
  db.sessions.set('id-2', ['second-session']);
  await provisionAdmins(deps(db, { ...env, ADMIN2_PASSWORD: 'updated-password-very-strong' }));
  assert.equal(db.sessions.has('id-1'), true);
  assert.equal(db.sessions.has('id-2'), false);
  assert.equal(db.users.get('second@example.com').password_hash, 'hash:updated-password-very-strong');
});

test('does not elevate existing students or teachers to admins', async () => {
  const db = database([{ id: 'student-1', email: 'second@example.com', role: 'student', password_hash: 'old' }]);
  await assert.rejects(provisionAdmins(deps(db)), /non-admin account/);
  assert.equal(db.users.get('second@example.com').role, 'student');
});

test('bad, missing, duplicate and short settings are rejected before any database writes', async () => {
  const invalid = [
    { ...env, ADMIN2_PASSWORD: undefined },
    { ...env, ADMIN2_PASSWORD: 'short' },
    { ...env, ADMIN2_EMAIL: ' ADMIN@EXAMPLE.COM ' },
    { ...env, ADMIN2_EMAIL: 'not-email' },
    { ...env, ADMIN2_NAME: 'a'.repeat(71) }
  ];
  for (const cfg of invalid) {
    const db = database();
    await assert.rejects(provisionAdmins(deps(db, cfg)));
    assert.equal(db.queries.length, 0);
  }
});

test('supports an optional ADMIN3 account and no administrators when unconfigured', async () => {
  assert.deepEqual(adminConfigs({}), []);
  const db = database();
  await provisionAdmins(deps(db, {
    ADMIN3_EMAIL: 'third@example.com',
    ADMIN3_PASSWORD: strongPassword
  }));
  assert.equal(db.users.get('third@example.com').role, 'admin');
});
