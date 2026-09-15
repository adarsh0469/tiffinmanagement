import express from 'express';
import { runQuery, getRow, getAll } from '../db.js';

const router = express.Router();

// Get list of closed/locked days
router.get('/', async (req, res) => {
  try {
    const closedDays = await getAll(`SELECT * FROM closed_days ORDER BY date DESC`);
    res.json({ success: true, closedDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Close/Lock a day (or mark tiffin center closed)
router.post('/', async (req, res) => {
  try {
    const { date, reason = 'Centre Closed / Holiday', closed_by = 'Owner' } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    await runQuery(
      `INSERT INTO closed_days (date, reason, closed_by) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET reason = excluded.reason, closed_by = excluded.closed_by`,
      [date, reason, closed_by]
    );

    // Also auto-mark all active customers as Skipped with reason on that closed day if needed
    const customers = await getAll(`SELECT id, rate_lunch, rate_dinner FROM customers WHERE status = 'Active'`);
    for (const c of customers) {
      await runQuery(
        `INSERT INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
         VALUES (?, ?, 'Lunch', 'Skipped', 0, ?, ?, ?)
         ON CONFLICT(customer_id, date, meal_slot) DO UPDATE SET status = 'Skipped', extra_notes = excluded.extra_notes`,
        [c.id, date, `Centre Closed: ${reason}`, c.rate_lunch, c.rate_dinner]
      );
      await runQuery(
        `INSERT INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
         VALUES (?, ?, 'Dinner', 'Skipped', 0, ?, ?, ?)
         ON CONFLICT(customer_id, date, meal_slot) DO UPDATE SET status = 'Skipped', extra_notes = excluded.extra_notes`,
        [c.id, date, `Centre Closed: ${reason}`, c.rate_lunch, c.rate_dinner]
      );
    }

    const closed = await getRow(`SELECT * FROM closed_days WHERE date = ?`, [date]);
    res.status(201).json({ success: true, closedDay: closed, message: `Day ${date} locked & marked closed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Unlock a day
router.delete('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    await runQuery(`DELETE FROM closed_days WHERE date = ?`, [date]);
    res.json({ success: true, message: `Day ${date} unlocked successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
