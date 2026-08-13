const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Connects using the DATABASE_URL Railway provides when you link a Postgres service.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

// Never let browsers cache these — stale cached responses can look like "my data disappeared"
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

// --- Simple key/value storage API (mirrors the shape the frontend expects) ---
app.get('/api/storage/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM kv_store WHERE key = $1', [req.params.key]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json({ value: result.rows[0].value });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/storage/:key', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO kv_store (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [req.params.key, req.body.value]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/storage/:key', async (req, res) => {
  try {
    await pool.query('DELETE FROM kv_store WHERE key = $1', [req.params.key]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// --- Static frontend ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
ensureTable()
  .then(() => {
    app.listen(PORT, () => console.log('Listening on port ' + PORT));
  })
  .catch(err => {
    console.error('Failed to set up database table:', err);
    process.exit(1);
  });
