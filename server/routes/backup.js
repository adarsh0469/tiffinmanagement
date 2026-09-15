import express from 'express';
import { runQuery, getAll } from '../db.js';

const router = express.Router();

// Export full database as JSON backup
router.get('/export', async (req, res) => {
  try {
    const customers = await getAll(`SELECT * FROM customers`);
    const daily_logs = await getAll(`SELECT * FROM daily_logs`);
    const payments = await getAll(`SELECT * FROM payments`);
    const customer_leaves = await getAll(`SELECT * FROM customer_leaves`);
    const closed_days = await getAll(`SELECT * FROM closed_days`);
    const settings = await getAll(`SELECT * FROM settings`);

    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      app: 'Adarsh Tiffin Centre',
      tables: {
        customers,
        daily_logs,
        payments,
        customer_leaves,
        closed_days,
        settings
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=adarsh_tiffin_backup_${new Date().toISOString().split('T')[0]}.json`);
    res.json(backupData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Restore database from JSON backup
router.post('/restore', async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.tables || !backup.tables.customers) {
      return res.status(400).json({ success: false, message: 'Invalid backup data payload' });
    }

    const { customers, daily_logs, payments, customer_leaves, closed_days, settings } = backup.tables;

    await runQuery('BEGIN TRANSACTION');

    try {
      // Clear existing tables
      await runQuery('DELETE FROM daily_logs');
      await runQuery('DELETE FROM payments');
      await runQuery('DELETE FROM customer_leaves');
      await runQuery('DELETE FROM closed_days');
      await runQuery('DELETE FROM customers');
      await runQuery('DELETE FROM settings');

      // Restore customers
      if (customers && customers.length) {
        for (const c of customers) {
          await runQuery(
            `INSERT INTO customers (id, name, phone, address, meal_preference, diet_type, plan_type, rate_lunch, rate_dinner, monthly_rate, advance_balance, status, start_date, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.name, c.phone, c.address, c.meal_preference, c.diet_type, c.plan_type, c.rate_lunch, c.rate_dinner, c.monthly_rate, c.advance_balance || 0, c.status, c.start_date, c.notes, c.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore daily_logs
      if (daily_logs && daily_logs.length) {
        for (const l of daily_logs) {
          await runQuery(
            `INSERT INTO daily_logs (id, customer_id, date, meal_slot, status, extra_amount, extra_notes, applied_lunch_rate, applied_dinner_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [l.id, l.customer_id, l.date, l.meal_slot, l.status, l.extra_amount || 0, l.extra_notes || '', l.applied_lunch_rate, l.applied_dinner_rate]
          );
        }
      }

      // Restore payments
      if (payments && payments.length) {
        for (const p of payments) {
          await runQuery(
            `INSERT INTO payments (id, customer_id, amount, payment_date, payment_mode, is_advance, month_year, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.customer_id, p.amount, p.payment_date, p.payment_mode, p.is_advance ? 1 : 0, p.month_year, p.notes, p.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore leaves
      if (customer_leaves && customer_leaves.length) {
        for (const cl of customer_leaves) {
          await runQuery(
            `INSERT INTO customer_leaves (id, customer_id, from_date, to_date, reason, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [cl.id, cl.customer_id, cl.from_date, cl.to_date, cl.reason, cl.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore closed_days
      if (closed_days && closed_days.length) {
        for (const cd of closed_days) {
          await runQuery(
            `INSERT INTO closed_days (id, date, reason, closed_by, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [cd.id, cd.date, cd.reason, cd.closed_by, cd.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore settings
      if (settings && settings.length) {
        for (const s of settings) {
          await runQuery(
            `INSERT INTO settings (key, value) VALUES (?, ?)`,
            [s.key, s.value]
          );
        }
      }

      await runQuery('COMMIT');
      res.json({ success: true, message: 'Database restored successfully from backup' });
    } catch (txErr) {
      await runQuery('ROLLBACK');
      res.status(500).json({ success: false, message: `Restore transaction failed: ${txErr.message}` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
