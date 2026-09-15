import express from 'express';
import { getRow, getAll } from '../db.js';
import { getDaysInMonth, formatDateLocal } from '../utils/dateUtils.js';

const router = express.Router();

// GET /api/reports - Optimized bulk queries
router.get('/', async (req, res) => {
  try {
    const {
      type = 'billing',
      month = formatDateLocal(new Date()).slice(0, 7),
      fromDate,
      toDate,
      status = 'All',
      plan_type = 'All',
      diet_type = 'All'
    } = req.query;

    const totalDaysInMonth = getDaysInMonth(month);
    const startDate = fromDate || `${month}-01`;
    const endDate = toDate || `${month}-${String(totalDaysInMonth).padStart(2, '0')}`;

    // Filter active/paused/all customers based on status
    let custSql = `SELECT * FROM customers WHERE 1=1`;
    const custParams = [];

    if (status !== 'All') {
      custSql += ` AND status = ?`;
      custParams.push(status);
    } else {
      custSql += ` AND status != 'Inactive'`;
    }

    if (plan_type !== 'All') {
      custSql += ` AND plan_type = ?`;
      custParams.push(plan_type);
    }

    if (diet_type !== 'All') {
      custSql += ` AND diet_type = ?`;
      custParams.push(diet_type);
    }

    custSql += ` ORDER BY name ASC`;
    const customers = await getAll(custSql, custParams);

    if (type === 'delivery') {
      // Bulk query daily logs for all filtered customers
      const allLogs = await getAll(
        `SELECT customer_id, meal_slot, status FROM daily_logs WHERE date >= ? AND date <= ?`,
        [startDate, endDate]
      );

      const logsMap = {};
      allLogs.forEach(l => {
        if (!logsMap[l.customer_id]) logsMap[l.customer_id] = [];
        logsMap[l.customer_id].push(l);
      });

      let totalLunchDelivered = 0;
      let totalDinnerDelivered = 0;
      let totalSkipped = 0;
      const customerDeliveryList = [];

      customers.forEach(c => {
        const logs = logsMap[c.id] || [];
        let lunchCount = 0;
        let dinnerCount = 0;
        let skipCount = 0;

        logs.forEach(l => {
          if (l.status === 'Delivered') {
            if (l.meal_slot === 'Lunch') lunchCount++;
            if (l.meal_slot === 'Dinner') dinnerCount++;
          } else if (l.status === 'Skipped' || l.status === 'Cancelled') {
            skipCount++;
          }
        });

        totalLunchDelivered += lunchCount;
        totalDinnerDelivered += dinnerCount;
        totalSkipped += skipCount;

        customerDeliveryList.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          meal_preference: c.meal_preference,
          diet_type: c.diet_type,
          lunchCount,
          dinnerCount,
          skipCount,
          totalDelivered: lunchCount + dinnerCount
        });
      });

      return res.json({
        success: true,
        type: 'delivery',
        period: { month, startDate, endDate },
        totals: {
          totalCustomers: customers.length,
          totalLunchDelivered,
          totalDinnerDelivered,
          totalMealsDelivered: totalLunchDelivered + totalDinnerDelivered,
          totalSkipped
        },
        rows: customerDeliveryList
      });
    }

    if (type === 'customer') {
      const customerRows = customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        meal_preference: c.meal_preference,
        diet_type: c.diet_type,
        plan_type: c.plan_type,
        rate_lunch: c.rate_lunch,
        rate_dinner: c.rate_dinner,
        monthly_rate: c.monthly_rate,
        advance_balance: c.advance_balance || 0,
        status: c.status,
        start_date: c.start_date
      }));

      const activeCount = customerRows.filter(c => c.status === 'Active').length;
      const pausedCount = customerRows.filter(c => c.status === 'Paused').length;
      const totalAdvance = customerRows.reduce((sum, c) => sum + c.advance_balance, 0);

      return res.json({
        success: true,
        type: 'customer',
        period: { month, startDate, endDate },
        totals: {
          totalCustomers: customerRows.length,
          activeCount,
          pausedCount,
          totalAdvance
        },
        rows: customerRows
      });
    }

    // Default: 'billing' report with bulk parallel queries
    const [allLogs, allPayments] = await Promise.all([
      getAll(`SELECT customer_id, meal_slot, status, extra_amount, applied_lunch_rate, applied_dinner_rate FROM daily_logs WHERE date >= ? AND date <= ?`, [startDate, endDate]),
      getAll(`SELECT customer_id, amount, is_advance FROM payments WHERE month_year = ? OR payment_date LIKE ?`, [month, `${month}%`])
    ]);

    const logsMap = {};
    allLogs.forEach(l => {
      if (!logsMap[l.customer_id]) logsMap[l.customer_id] = [];
      logsMap[l.customer_id].push(l);
    });

    const paymentsMap = {};
    allPayments.forEach(p => {
      if (!paymentsMap[p.customer_id]) paymentsMap[p.customer_id] = [];
      paymentsMap[p.customer_id].push(p);
    });

    const billingRows = [];
    let grandTotalBilled = 0;
    let grandTotalPaid = 0;
    let grandTotalPending = 0;
    let grandTotalAdvance = 0;

    customers.forEach(c => {
      const logs = logsMap[c.id] || [];
      const payments = paymentsMap[c.id] || [];

      let lCount = 0;
      let dCount = 0;
      let extraSum = 0;
      let calculatedPerMealTotal = 0;

      logs.forEach(l => {
        if (l.status === 'Delivered') {
          if (l.meal_slot === 'Lunch') {
            lCount++;
            calculatedPerMealTotal += (l.applied_lunch_rate ?? c.rate_lunch ?? 80);
          }
          if (l.meal_slot === 'Dinner') {
            dCount++;
            calculatedPerMealTotal += (l.applied_dinner_rate ?? c.rate_dinner ?? 80);
          }
        }
        extraSum += (l.extra_amount || 0);
      });

      let baseBill = 0;
      if (c.plan_type === 'Monthly') {
        baseBill = c.monthly_rate;
      } else {
        baseBill = calculatedPerMealTotal;
      }

      const totalBill = baseBill + extraSum;
      const directPayments = payments.filter(p => !p.is_advance).reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const advance = c.advance_balance || 0;

      const unpaidAfterDirect = Math.max(0, totalBill - directPayments);
      const advanceApplied = Math.min(unpaidAfterDirect, advance);
      const netDue = Math.max(0, unpaidAfterDirect - advanceApplied);

      grandTotalBilled += totalBill;
      grandTotalPaid += totalPaid;
      grandTotalPending += netDue;
      grandTotalAdvance += advance;

      billingRows.push({
        id: c.id,
        name: c.name,
        phone: c.phone,
        plan_type: c.plan_type,
        lunchCount: lCount,
        dinnerCount: dCount,
        extraSum,
        totalBill,
        directPayments,
        totalPaid,
        advanceBalance: advance,
        advanceApplied,
        netDue
      });
    });

    return res.json({
      success: true,
      type: 'billing',
      period: { month, startDate, endDate },
      totals: {
        totalCustomers: billingRows.length,
        grandTotalBilled,
        grandTotalPaid,
        grandTotalPending,
        grandTotalAdvance
      },
      rows: billingRows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
