import express from 'express';
import { getRow, getAll } from '../db.js';

const router = express.Router();

// Executive dashboard metrics
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    // Active & Paused customer counts
    const activeCountObj = await getRow(`SELECT COUNT(*) as count FROM customers WHERE status = 'Active'`);
    const pausedCountObj = await getRow(`SELECT COUNT(*) as count FROM customers WHERE status = 'Paused'`);

    // Today's meal logs
    const todayLogs = await getAll(`SELECT * FROM daily_logs WHERE date = ?`, [today]);

    // Active customers
    const activeCustomers = await getAll(`SELECT * FROM customers WHERE status = 'Active'`);

    // Calculate expected vs marked for today
    let todayLunchToPrepare = 0;
    let todayDinnerToPrepare = 0;
    let todayLunchDelivered = 0;
    let todayDinnerDelivered = 0;

    activeCustomers.forEach(c => {
      if (c.meal_preference === 'Both' || c.meal_preference === 'Lunch') todayLunchToPrepare++;
      if (c.meal_preference === 'Both' || c.meal_preference === 'Dinner') todayDinnerToPrepare++;
    });

    todayLogs.forEach(l => {
      if (l.status === 'Delivered') {
        if (l.meal_slot === 'Lunch') todayLunchDelivered++;
        if (l.meal_slot === 'Dinner') todayDinnerDelivered++;
      }
    });

    // Collection stats for current month
    const totalCollectedObj = await getRow(
      `SELECT SUM(amount) as total FROM payments WHERE month_year = ? OR payment_date LIKE ?`,
      [currentMonth, `${currentMonth}%`]
    );

    // Calculate total pending for all active customers for current month
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-31`;
    let totalPendingMonth = 0;
    let totalBilledMonth = 0;

    const allCustomers = await getAll(`SELECT * FROM customers WHERE status != 'Inactive'`);
    for (const c of allCustomers) {
      const cLogs = await getAll(
        `SELECT * FROM daily_logs WHERE customer_id = ? AND date >= ? AND date <= ?`,
        [c.id, startDate, endDate]
      );
      const cPayments = await getAll(
        `SELECT * FROM payments WHERE customer_id = ? AND (month_year = ? OR payment_date LIKE ?)`,
        [c.id, currentMonth, `${currentMonth}%`]
      );

      let lCount = 0;
      let dCount = 0;
      let extraSum = 0;
      cLogs.forEach(log => {
        if (log.status === 'Delivered') {
          if (log.meal_slot === 'Lunch') lCount++;
          if (log.meal_slot === 'Dinner') dCount++;
        }
        extraSum += (log.extra_amount || 0);
      });

      let base = 0;
      if (c.plan_type === 'Monthly') {
        base = c.monthly_rate;
      } else {
        base = (lCount * c.rate_lunch) + (dCount * c.rate_dinner);
      }
      const bill = base + extraSum;
      const paid = cPayments.reduce((sum, p) => sum + p.amount, 0);
      const due = bill - paid;

      totalBilledMonth += bill;
      if (due > 0) totalPendingMonth += due;
    }

    res.json({
      today,
      currentMonth,
      activeCustomers: activeCountObj?.count || 0,
      pausedCustomers: pausedCountObj?.count || 0,
      todayLunchToPrepare,
      todayDinnerToPrepare,
      todayLunchDelivered,
      todayDinnerDelivered,
      monthCollected: totalCollectedObj?.total || 0,
      monthBilled: totalBilledMonth,
      monthPending: totalPendingMonth
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
