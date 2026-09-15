import express from 'express';
import { runQuery, getRow, getAll } from '../db.js';

const router = express.Router();

// Get daily logs for a given date (default today)
router.get('/', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    // Check if day is locked/closed
    const closedDay = await getRow(`SELECT * FROM closed_days WHERE date = ?`, [date]);

    // Get all active or paused customers
    const customers = await getAll(
      `SELECT * FROM customers WHERE status != 'Inactive' ORDER BY name ASC`
    );

    // Get existing logs for this date
    const logs = await getAll(
      `SELECT * FROM daily_logs WHERE date = ?`,
      [date]
    );

    // Get active leaves overlapping this date
    const leaves = await getAll(
      `SELECT * FROM customer_leaves WHERE from_date <= ? AND to_date >= ?`,
      [date, date]
    );
    const leaveSet = new Set(leaves.map(l => l.customer_id));

    // Map logs by customer_id and meal_slot
    const logMap = {};
    logs.forEach(log => {
      if (!logMap[log.customer_id]) logMap[log.customer_id] = {};
      logMap[log.customer_id][log.meal_slot] = log;
    });

    // Merge customer data with logs
    const result = customers.map(c => {
      const cLogs = logMap[c.id] || {};
      const isOnLeave = leaveSet.has(c.id);

      const defaultLunchStatus = closedDay ? 'Skipped' : (isOnLeave || c.status === 'Paused' ? 'Skipped' : (c.meal_preference === 'Dinner' ? 'Skipped' : 'Delivered'));
      const defaultDinnerStatus = closedDay ? 'Skipped' : (isOnLeave || c.status === 'Paused' ? 'Skipped' : (c.meal_preference === 'Lunch' ? 'Skipped' : 'Delivered'));

      const lRate = (c.rate_lunch && c.rate_lunch > 0) ? c.rate_lunch : 80;
      const dRate = (c.rate_dinner && c.rate_dinner > 0) ? c.rate_dinner : 80;

      return {
        customer: c,
        isOnLeave,
        lunch: cLogs['Lunch'] || {
          customer_id: c.id,
          date,
          meal_slot: 'Lunch',
          status: defaultLunchStatus,
          extra_amount: 0,
          extra_notes: isOnLeave ? 'On Leave' : (closedDay ? `Closed: ${closedDay.reason}` : ''),
          applied_lunch_rate: lRate,
          applied_dinner_rate: dRate
        },
        dinner: cLogs['Dinner'] || {
          customer_id: c.id,
          date,
          meal_slot: 'Dinner',
          status: defaultDinnerStatus,
          extra_amount: 0,
          extra_notes: isOnLeave ? 'On Leave' : (closedDay ? `Closed: ${closedDay.reason}` : ''),
          applied_lunch_rate: lRate,
          applied_dinner_rate: dRate
        }
      };
    });

    res.json({ success: true, date, closedDay, logs: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update or Upsert single meal status with rate snapshot
router.post('/single', async (req, res) => {
  try {
    const { customer_id, date, meal_slot, status, extra_amount = 0, extra_notes = '' } = req.body;

    if (!customer_id || !date || !meal_slot) {
      return res.status(400).json({ success: false, message: 'Customer ID, date, and meal slot are required' });
    }

    // Look up customer current rate snapshot
    const customer = await getRow(`SELECT rate_lunch, rate_dinner FROM customers WHERE id = ?`, [customer_id]);
    const lunchRate = (customer && customer.rate_lunch > 0) ? customer.rate_lunch : 80;
    const dinnerRate = (customer && customer.rate_dinner > 0) ? customer.rate_dinner : 80;

    await runQuery(
      `INSERT INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(customer_id, date, meal_slot) 
       DO UPDATE SET 
         status = excluded.status, 
         extra_amount = excluded.extra_amount, 
         extra_notes = excluded.extra_notes,
         applied_lunch_rate = CASE WHEN COALESCE(daily_logs.applied_lunch_rate, 0) > 0 THEN daily_logs.applied_lunch_rate ELSE excluded.applied_lunch_rate END,
         applied_dinner_rate = CASE WHEN COALESCE(daily_logs.applied_dinner_rate, 0) > 0 THEN daily_logs.applied_dinner_rate ELSE excluded.applied_dinner_rate END`,
      [customer_id, date, meal_slot, status, extra_amount, extra_notes, lunchRate, dinnerRate]
    );

    const updated = await getRow(
      `SELECT * FROM daily_logs WHERE customer_id = ? AND date = ? AND meal_slot = ?`,
      [customer_id, date, meal_slot]
    );

    res.json({ success: true, log: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Batch mark meal slot (e.g. Mark all Lunch as Delivered for date)
router.post('/batch', async (req, res) => {
  try {
    const { date, meal_slot, status = 'Delivered' } = req.body;

    if (!date || !meal_slot) {
      return res.status(400).json({ success: false, message: 'Date and meal slot are required' });
    }

    // Get active customers whose meal preference includes this slot and not on leave
    const customers = await getAll(`SELECT id, meal_preference, status, rate_lunch, rate_dinner FROM customers WHERE status = 'Active'`);
    const leaves = await getAll(`SELECT customer_id FROM customer_leaves WHERE from_date <= ? AND to_date >= ?`, [date, date]);
    const leaveSet = new Set(leaves.map(l => l.customer_id));

    const tasks = customers.map(async (c) => {
      if (leaveSet.has(c.id)) return false; // Skip customer on leave

      let isEligible = false;
      if (c.meal_preference === 'Both') isEligible = true;
      else if (c.meal_preference === meal_slot) isEligible = true;

      if (isEligible) {
        const lRate = (c.rate_lunch && c.rate_lunch > 0) ? c.rate_lunch : 80;
        const dRate = (c.rate_dinner && c.rate_dinner > 0) ? c.rate_dinner : 80;

        await runQuery(
          `INSERT INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
           VALUES (?, ?, ?, ?, 0, '', ?, ?)
           ON CONFLICT(customer_id, date, meal_slot) 
           DO UPDATE SET 
             status = excluded.status,
             applied_lunch_rate = CASE WHEN COALESCE(daily_logs.applied_lunch_rate, 0) > 0 THEN daily_logs.applied_lunch_rate ELSE excluded.applied_lunch_rate END,
             applied_dinner_rate = CASE WHEN COALESCE(daily_logs.applied_dinner_rate, 0) > 0 THEN daily_logs.applied_dinner_rate ELSE excluded.applied_dinner_rate END`,
          [c.id, date, meal_slot, status, lRate, dRate]
        );
        return true;
      }
      return false;
    });

    const results = await Promise.all(tasks);
    const updatedCount = results.filter(Boolean).length;

    res.json({ success: true, count: updatedCount, message: `Successfully batch updated ${updatedCount} ${meal_slot} meals as ${status} for ${date}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
