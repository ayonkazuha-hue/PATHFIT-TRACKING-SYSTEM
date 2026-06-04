/**
 * SupabaseSessionStore
 * Stores express-session data in a Supabase table (user_sessions)
 * using the Supabase JS client + service key — no direct DB password needed.
 *
 * Table required (run create_session_table.sql in Supabase):
 *   user_sessions (sid TEXT PRIMARY KEY, sess JSONB, expire TIMESTAMPTZ)
 */

const { Store } = require('express-session');

class SupabaseSessionStore extends Store {
  constructor(supabaseAdmin, options = {}) {
    super();
    this.supabase  = supabaseAdmin;
    this.table     = options.table     || 'user_sessions';
    this.ttl       = options.ttl       || 7 * 24 * 60 * 60; // 7 days in seconds
    this.cleanupInterval = options.cleanupInterval || 15 * 60 * 1000; // 15 min

    // Periodically delete expired sessions
    if (this.cleanupInterval > 0) {
      this._cleanupTimer = setInterval(() => this._cleanup(), this.cleanupInterval);
      if (this._cleanupTimer.unref) this._cleanupTimer.unref(); // don't block process exit
    }
  }

  // Calculate expiry timestamp
  _expireAt(session) {
    const ttl = (session.cookie && session.cookie.maxAge)
      ? Math.floor(session.cookie.maxAge / 1000)
      : this.ttl;
    return new Date(Date.now() + ttl * 1000).toISOString();
  }

  // GET session
  async get(sid, callback) {
    try {
      const { data, error } = await this.supabase
        .from(this.table)
        .select('sess, expire')
        .eq('sid', sid)
        .maybeSingle();

      if (error) return callback(error, null);
      if (!data)  return callback(null, null);

      // Check expiry
      if (data.expire && new Date(data.expire) < new Date()) {
        await this.destroy(sid, () => {});
        return callback(null, null);
      }

      callback(null, data.sess);
    } catch (err) {
      callback(err, null);
    }
  }

  // SET session (upsert)
  async set(sid, session, callback) {
    try {
      const expire = this._expireAt(session);
      const { error } = await this.supabase
        .from(this.table)
        .upsert({ sid, sess: session, expire }, { onConflict: 'sid' });

      callback(error || null);
    } catch (err) {
      callback(err);
    }
  }

  // DESTROY session
  async destroy(sid, callback) {
    try {
      await this.supabase.from(this.table).delete().eq('sid', sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // TOUCH — refresh expiry without changing data
  async touch(sid, session, callback) {
    try {
      const expire = this._expireAt(session);
      await this.supabase
        .from(this.table)
        .update({ expire })
        .eq('sid', sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // LENGTH — count active sessions
  async length(callback) {
    try {
      const { count, error } = await this.supabase
        .from(this.table)
        .select('sid', { count: 'exact', head: true })
        .gt('expire', new Date().toISOString());
      if (error) return callback(error, 0);
      callback(null, count || 0);
    } catch (err) {
      callback(err, 0);
    }
  }

  // CLEAR — delete all sessions
  async clear(callback) {
    try {
      const { error } = await this.supabase.from(this.table).delete().neq('sid', '');
      callback(error || null);
    } catch (err) {
      callback(err);
    }
  }

  // Delete expired sessions
  async _cleanup() {
    try {
      await this.supabase
        .from(this.table)
        .delete()
        .lt('expire', new Date().toISOString());
    } catch (_) {}
  }
}

module.exports = SupabaseSessionStore;
