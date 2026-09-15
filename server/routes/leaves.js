import express from 'express';
import { runQuery, getRow, getAll } from '../db.js';

const router = express.Router();

// Get customer leaves (optional customer_id filter)
router.get('/', async (req, res) => {
  try {
    const { customer_id } = req.query;
    let sql = `SELECT l.*, c.name as customer_name, c.phone as customer_phone 
               FROM customer_leaves l 
               JOIN customers c ON l.customer_id = c.id 
               WHERE 1=1`;
    const params = [];

    if (customer_id) {
      sql += ` AND l.customer_id = ?`;
      params.push(customer_id);
    }

    sql += ` ORDER BY l.from_date DESC`;

    const leaves = await getAll(sql, params);
    res.json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add leave range
router.post('/', async (req, res) => {
  try {
    const { customer_id, from_date, to_date, reason = '' } = req.body;

    if (!customer_id || !from_date || !to_date) {
      return res.status(400).json({ success: false, message: 'Customer ID, from_date, and to_date are required' });
    }

    if (from_date > to_date) {
      return res.status(400).json({ success: false, message: 'From date cannot be after To date' });
    }

    const result = await runQuery(
      `INSERT INTO customer_leaves (customer_id, from_date, to_date, reason) VALUES (?, ?, ?, ?)`,
      [customer_id, from_date, to_date, reason]
    );

    // Auto-mark daily logs in the leave range as Skipped if logs exist or optionally seed them
    let curr = new Date(from_date + 'T00:00:00');
    const end = new Date(to_date + 'T00:00:00');
    const customer = await getRow(`SELECT * FROM customers WHERE id = ?`, [customer_id]);

    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const lunchRate = customer ? customer.rate_lunch : 80;
      const dinnerRate = customer ? customer.rate_dinner : 80;

      if (customer.meal_preference === 'Both' || customer.meal_preference === 'Lunch') {
        await runQuery(
          `INSERT INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
           VALUES (?, ?, 'Lunch', 'Skipped', 0, 'On Leave', ?, ?)
           ON CONFLICT(customer_id, date, meal_slot) DO UPDATE SET status = 'Skipped', extra_notes = 'On Leave'`,
          [customer_id, dateStr, lunchRate, dinnerRate]
        );
      }
      if (customer.meal_preference === 'Both' || customer.meal_preference === 'Dinner') {
        await runQuery(
          `INSERT INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
           VALUES (?, ?, 'Dinner', 'Skipped', 0, 'On Leave', ?, ?)
           ON CONFLICT(customer_id, date, meal_slot) DO UPDATE SET status = 'Skipped', extra_notes = 'On Leave'`,
          [customer_id, dateStr, lunchRate, dinnerRate]
        );
      }
      curr.setDate(curr.getDate() + 1);
    }

    const newLeave = await getRow(`SELECT * FROM customer_leaves WHERE id = ?`, [result.lastID]);
    res.status(201).json({ success: true, leave: newLeave, message: 'Leave record created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete leave record
router.delete('/:id', async (req, res) => {
  try {
    await runQuery(`DELETE FROM customer_leaves WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Leave record deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
