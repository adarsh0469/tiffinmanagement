import express from 'express';
import { runQuery, getAll } from '../db.js';

const router = express.Router();

// Get settings as key-value object
router.get('/', async (req, res) => {
  try {
    const rows = await getAll(`SELECT * FROM settings`);
    const settingsObj = {};
    rows.forEach(r => {
      settingsObj[r.key] = r.value;
    });
    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    const settingsObj = req.body;
    for (const [key, value] of Object.entries(settingsObj)) {
      await runQuery(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      );
    }
    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
