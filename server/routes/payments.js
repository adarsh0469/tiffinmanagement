import express from 'express';
import { runQuery, getRow, getAll } from '../db.js';

const router = express.Router();

// Get payments list
router.get('/', async (req, res) => {
  try {
    const { customer_id, month } = req.query;
    let sql = `SELECT p.*, c.name as customer_name, c.phone as customer_phone 
               FROM payments p 
               JOIN customers c ON p.customer_id = c.id 
               WHERE 1=1`;
    const params = [];

    if (customer_id) {
      sql += ` AND p.customer_id = ?`;
      params.push(customer_id);
    }

    if (month) {
      sql += ` AND (p.month_year = ? OR p.payment_date LIKE ?)`;
      params.push(month, `${month}%`);
    }

    sql += ` ORDER BY p.payment_date DESC, p.id DESC`;

    const payments = await getAll(sql, params);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Record new payment / advance deposit
router.post('/', async (req, res) => {
  try {
    const {
      customer_id,
      amount,
      payment_date = new Date().toISOString().split('T')[0],
      payment_mode = 'UPI',
      is_advance = 0,
      month_year = new Date().toISOString().slice(0, 7),
      notes = ''
    } = req.body;

    const numAmount = parseFloat(amount);
    if (!customer_id || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Customer ID and valid positive amount are required' });
    }

    // Insert payment record
    const result = await runQuery(
      `INSERT INTO payments (customer_id, amount, payment_date, payment_mode, is_advance, month_year, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, numAmount, payment_date, payment_mode, is_advance ? 1 : 0, month_year, notes]
    );

    // If marked as advance deposit, increment customer's advance_balance
    if (is_advance) {
      await runQuery(
        `UPDATE customers SET advance_balance = COALESCE(advance_balance, 0) + ? WHERE id = ?`,
        [numAmount, customer_id]
      );
    }

    const payment = await getRow(
      `SELECT p.*, c.name as customer_name, c.advance_balance 
       FROM payments p 
       JOIN customers c ON p.customer_id = c.id 
       WHERE p.id = ?`,
      [result.lastID]
    );

    res.status(201).json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Edit existing payment record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_date, payment_mode, is_advance, month_year, notes } = req.body;

    const existingPayment = await getRow(`SELECT * FROM payments WHERE id = ?`, [id]);
    if (!existingPayment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const newAmount = parseFloat(amount);
    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }

    const oldIsAdvance = existingPayment.is_advance ? 1 : 0;
    const oldAmount = existingPayment.amount;
    const newIsAdvance = is_advance ? 1 : 0;

    // Adjust customer advance balance if advance status or amount changed
    if (oldIsAdvance && !newIsAdvance) {
      // Deduct old advance amount
      await runQuery(
        `UPDATE customers SET advance_balance = MAX(0, COALESCE(advance_balance, 0) - ?) WHERE id = ?`,
        [oldAmount, existingPayment.customer_id]
      );
    } else if (!oldIsAdvance && newIsAdvance) {
      // Add new advance amount
      await runQuery(
        `UPDATE customers SET advance_balance = COALESCE(advance_balance, 0) + ? WHERE id = ?`,
        [newAmount, existingPayment.customer_id]
      );
    } else if (oldIsAdvance && newIsAdvance) {
      // Delta adjustment
      const diff = newAmount - oldAmount;
      await runQuery(
        `UPDATE customers SET advance_balance = MAX(0, COALESCE(advance_balance, 0) + ?) WHERE id = ?`,
        [diff, existingPayment.customer_id]
      );
    }

    await runQuery(
      `UPDATE payments SET amount = ?, payment_date = ?, payment_mode = ?, is_advance = ?, month_year = ?, notes = ?
       WHERE id = ?`,
      [newAmount, payment_date || existingPayment.payment_date, payment_mode || existingPayment.payment_mode, newIsAdvance, month_year || existingPayment.month_year, notes ?? existingPayment.notes, id]
    );

    const updated = await getRow(
      `SELECT p.*, c.name as customer_name, c.advance_balance 
       FROM payments p 
       JOIN customers c ON p.customer_id = c.id 
       WHERE p.id = ?`,
      [id]
    );

    res.json({ success: true, payment: updated, message: 'Payment record updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete payment record
router.delete('/:id', async (req, res) => {
  try {
    const payment = await getRow(`SELECT * FROM payments WHERE id = ?`, [req.params.id]);
    if (payment && payment.is_advance) {
      // Revert advance balance adjustment
      await runQuery(
        `UPDATE customers SET advance_balance = MAX(0, COALESCE(advance_balance, 0) - ?) WHERE id = ?`,
        [payment.amount, payment.customer_id]
      );
    }
    await runQuery(`DELETE FROM payments WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Payment record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
