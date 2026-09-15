import express from 'express';
import { runQuery, getRow, getAll } from '../db.js';

const router = express.Router();

// Get all customers with optional multi-filters (status, diet_type, meal_preference, plan_type, search)
router.get('/', async (req, res) => {
  try {
    const { status, diet_type, meal_preference, plan_type, search } = req.query;
    let sql = `SELECT * FROM customers WHERE 1=1`;
    const params = [];

    if (status && status !== 'All') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (diet_type && diet_type !== 'All') {
      sql += ` AND diet_type = ?`;
      params.push(diet_type);
    }

    if (meal_preference && meal_preference !== 'All') {
      sql += ` AND meal_preference = ?`;
      params.push(meal_preference);
    }

    if (plan_type && plan_type !== 'All') {
      sql += ` AND plan_type = ?`;
      params.push(plan_type);
    }

    if (search) {
      sql += ` AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY name ASC`;

    const customers = await getAll(sql, params);
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single customer details along with active leaves
router.get('/:id', async (req, res) => {
  try {
    const customer = await getRow(`SELECT * FROM customers WHERE id = ?`, [req.params.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const leaves = await getAll(
      `SELECT * FROM customer_leaves WHERE customer_id = ? ORDER BY from_date DESC`,
      [req.params.id]
    );

    res.json({ success: true, customer, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new customer
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      meal_preference = 'Both',
      diet_type = 'Veg',
      plan_type = 'PerMeal',
      rate_lunch = 80,
      rate_dinner = 80,
      monthly_rate = 3000,
      advance_balance = 0,
      status = 'Active',
      start_date = new Date().toISOString().split('T')[0],
      notes = ''
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and Phone number are required' });
    }

    let finalLunchRate = parseFloat(rate_lunch) || 80;
    let finalDinnerRate = parseFloat(rate_dinner) || 80;

    if (plan_type === 'Monthly' && parseFloat(monthly_rate) > 0) {
      const slots = meal_preference === 'Both' ? 2 : 1;
      const perMeal = Math.round(parseFloat(monthly_rate) / (30 * slots));
      finalLunchRate = perMeal > 0 ? perMeal : 60;
      finalDinnerRate = perMeal > 0 ? perMeal : 60;
    }

    const result = await runQuery(
      `INSERT INTO customers (name, phone, address, meal_preference, diet_type, plan_type, rate_lunch, rate_dinner, monthly_rate, advance_balance, status, start_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, address, meal_preference, diet_type, plan_type, finalLunchRate, finalDinnerRate, monthly_rate, advance_balance, status, start_date, notes]
    );

    const newCustomer = await getRow(`SELECT * FROM customers WHERE id = ?`, [result.lastID]);
    res.status(201).json({ success: true, customer: newCustomer, message: 'Customer created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      meal_preference,
      diet_type,
      plan_type,
      rate_lunch,
      rate_dinner,
      monthly_rate,
      advance_balance,
      status,
      start_date,
      notes
    } = req.body;

    let finalLunchRate = parseFloat(rate_lunch) || 80;
    let finalDinnerRate = parseFloat(rate_dinner) || 80;

    if (plan_type === 'Monthly' && parseFloat(monthly_rate) > 0) {
      const slots = meal_preference === 'Both' ? 2 : 1;
      const perMeal = Math.round(parseFloat(monthly_rate) / (30 * slots));
      finalLunchRate = perMeal > 0 ? perMeal : 60;
      finalDinnerRate = perMeal > 0 ? perMeal : 60;
    }

    await runQuery(
      `UPDATE customers SET 
       name = ?, phone = ?, address = ?, meal_preference = ?, diet_type = ?, 
       plan_type = ?, rate_lunch = ?, rate_dinner = ?, monthly_rate = ?, 
       advance_balance = ?, status = ?, start_date = ?, notes = ?
       WHERE id = ?`,
      [name, phone, address, meal_preference, diet_type, plan_type, finalLunchRate, finalDinnerRate, monthly_rate, advance_balance || 0, status, start_date, notes, req.params.id]
    );

    const updated = await getRow(`SELECT * FROM customers WHERE id = ?`, [req.params.id]);
    res.json({ success: true, customer: updated, message: 'Customer updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Quick toggle status (Active / Paused / Inactive)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await runQuery(`UPDATE customers SET status = ? WHERE id = ?`, [status, req.params.id]);
    const updated = await getRow(`SELECT * FROM customers WHERE id = ?`, [req.params.id]);
    res.json({ success: true, customer: updated, message: `Status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    await runQuery(`DELETE FROM customers WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
