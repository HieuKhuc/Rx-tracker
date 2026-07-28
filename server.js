const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Data lives in a JSON file. On Railway, mount a Volume at DATA_DIR (see README)
// so this survives redeploys — otherwise it resets whenever the container rebuilds.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveDB(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db));
}

// --- Simple key/value storage API (mirrors the shape the frontend expects) ---
app.get('/api/storage/:key', (req, res) => {
  const db = loadDB();
  const value = db[req.params.key];
  if (value === undefined) return res.status(404).json({ error: 'not found' });
  res.json({ value });
});

app.post('/api/storage/:key', (req, res) => {
  const db = loadDB();
  db[req.params.key] = req.body.value;
  saveDB(db);
  res.json({ ok: true });
});

app.delete('/api/storage/:key', (req, res) => {
  const db = loadDB();
  delete db[req.params.key];
  saveDB(db);
  res.json({ ok: true });
});

// --- Static frontend ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Listening on port ' + PORT));
