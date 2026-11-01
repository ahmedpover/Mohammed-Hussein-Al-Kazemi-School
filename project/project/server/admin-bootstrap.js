/**
 * Provision administrator accounts from Railway environment variables.
 * The original ADMIN_* variables remain supported; ADMIN2_* through ADMIN10_*
 * allow additional administrators without changing the database schema.
 *
 * Existing non-admin accounts are never promoted automatically.
 */
export function adminConfigs(env = process.env) {
  const prefixes = ['ADMIN', ...Array.from({ length: 9 }, (_, i) => `ADMIN${i + 2}`)];
  const configs = [];
  const emails = new Set();

  for (const prefix of prefixes) {
    const emailValue = env[`${prefix}_EMAIL`];
    const passwordValue = env[`${prefix}_PASSWORD`];
    const nameValue = env[`${prefix}_NAME`];
    if (emailValue === undefined && passwordValue === undefined && nameValue === undefined) continue;

    const email = String(emailValue || '').trim().toLowerCase();
    const password = passwordValue;
    const name = String(nameValue || '').trim() || 'إدارة المدرسة';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== 'string' || password.length < 12 || password.length > 128 ||
        name.length > 70) {
      throw new Error(`${prefix} configuration invalid: a valid email, a 12–128 character password, and a name up to 70 characters are required.`);
    }
    if (emails.has(email)) throw new Error(`Administrator email configured more than once (${prefix}).`);
    emails.add(email);
    configs.push({ prefix, email, password, name });
  }
  return configs;
}

/**
 * Only provision a new admin or synchronize an existing admin's password.
 * Password changes revoke that administrator's sessions, not other admins'.
 */
export async function provisionAdmins({ env = process.env, query, hash, verify, id, logger = console }) {
  const admins = adminConfigs(env); // Validate all configurations before writing.
  for (const item of admins) {
    const { rows } = await query('SELECT id,role,password_hash FROM users WHERE email=$1', [item.email]);
    if (rows.length && rows[0].role !== 'admin') {
      throw new Error(`${item.prefix} email already belongs to a non-admin account; refusing to elevate permissions.`);
    }
    if (!rows.length) {
      await query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',
        [id(), item.email, item.name, await hash(item.password), 'admin']);
      logger.log(`${item.prefix}: administrator created`);
    } else if (!(await verify(item.password, rows[0].password_hash))) {
      await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hash(item.password), rows[0].id]);
      await query('DELETE FROM sessions WHERE user_id=$1', [rows[0].id]);
      logger.log(`${item.prefix}: administrator password synchronized; previous sessions revoked`);
    }
  }
}
