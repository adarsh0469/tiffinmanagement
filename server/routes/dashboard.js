import express from 'express';
import { getRow, getAll } from '../db.js';

const router = express.Router();

// Executive dashboard metrics - High performance optimized bulk queries
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

    // Fast bulk calculation of total billed and pending for current month
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-31`;

    const [allCustomers, allLogs, allPayments] = await Promise.all([
      getAll(`SELECT * FROM customers WHERE status != 'Inactive'`),
      getAll(`SELECT customer_id, meal_slot, status, extra_amount, applied_lunch_rate, applied_dinner_rate FROM daily_logs WHERE date >= ? AND date <= ?`, [startDate, endDate]),
      getAll(`SELECT customer_id, amount FROM payments WHERE month_year = ? OR payment_date LIKE ?`, [currentMonth, `${currentMonth}%`])
    ]);

    // Build fast in-memory lookup maps
    const logsMap = {};
    allLogs.forEach(log => {
      if (!logsMap[log.customer_id]) logsMap[log.customer_id] = [];
      logsMap[log.customer_id].push(log);
    });

    const paymentsMap = {};
    allPayments.forEach(p => {
      paymentsMap[p.customer_id] = (paymentsMap[p.customer_id] || 0) + (p.amount || 0);
    });

    let totalPendingMonth = 0;
    let totalBilledMonth = 0;

    allCustomers.forEach(c => {
      const cLogs = logsMap[c.id] || [];
      const paid = paymentsMap[c.id] || 0;

      let lCount = 0;
      let dCount = 0;
      let extraSum = 0;
      let calculatedPerMealTotal = 0;

      cLogs.forEach(log => {
        if (log.status === 'Delivered') {
          if (log.meal_slot === 'Lunch') {
            lCount++;
            calculatedPerMealTotal += (log.applied_lunch_rate ?? c.rate_lunch ?? 80);
          }
          if (log.meal_slot === 'Dinner') {
            dCount++;
            calculatedPerMealTotal += (log.applied_dinner_rate ?? c.rate_dinner ?? 80);
          }
        }
        extraSum += (log.extra_amount || 0);
      });

      let base = 0;
      if (c.plan_type === 'Monthly') {
        base = c.monthly_rate;
      } else {
        base = calculatedPerMealTotal;
      }

      const bill = base + extraSum;
      const due = bill - paid;

      totalBilledMonth += bill;
      if (due > 0) totalPendingMonth += due;
    });

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
