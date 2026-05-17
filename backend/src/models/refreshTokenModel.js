const db = require('../utils/db');

async function create({
  userId,
  tokenHash,
  expiresAt,
  userAgent = null,
  ipAddress = null,
}) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress],
  );
}

// Grace period (giây) cho phép dùng lại token vừa bị rotation revoke,
// tránh race condition khi FE bắn nhiều request /refresh song song.
const REVOKE_GRACE_SECONDS = 30;

async function findActiveByHash(tokenHash) {
  const result = await db.query(
    `SELECT id, user_id, token_hash, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1
       AND expires_at > NOW()
       AND (revoked_at IS NULL OR revoked_at > NOW() - ($2 || ' seconds')::interval)
     LIMIT 1`,
    [tokenHash, REVOKE_GRACE_SECONDS],
  );
  return result.rows[0] || null;
}

async function revokeByHash(tokenHash) {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash],
  );
}

module.exports = {
  create,
  findActiveByHash,
  revokeByHash,
};
