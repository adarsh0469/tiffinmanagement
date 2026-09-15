import express from 'express';
import { getRow, getAll } from '../db.js';
import { getDaysInMonth, getDayName, formatDateLocal } from '../utils/dateUtils.js';

const router = express.Router();

// Get detailed bill & day-by-day breakdown for a customer
router.get('/customer/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const { month = formatDateLocal(new Date()).slice(0, 7), fromDate, toDate } = req.query;

    const customer = await getRow(`SELECT * FROM customers WHERE id = ?`, [customerId]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const totalDays = getDaysInMonth(month);

    // Default to full calendar month so all days of the selected month are shown
    const effectiveStartDate = fromDate || `${month}-01`;
    const effectiveEndDate = toDate || `${month}-${String(totalDays).padStart(2, '0')}`;

    // Fetch daily logs for this date window
    const logs = await getAll(
      `SELECT * FROM daily_logs 
       WHERE customer_id = ? AND date >= ? AND date <= ? 
       ORDER BY date ASC, meal_slot ASC`,
      [customerId, effectiveStartDate, effectiveEndDate]
    );

    // Fetch payments for this date window or month
    const payments = await getAll(
      `SELECT * FROM payments 
       WHERE customer_id = ? AND ((payment_date >= ? AND payment_date <= ?) OR month_year = ? OR payment_date LIKE ?) 
       ORDER BY payment_date ASC`,
      [customerId, effectiveStartDate, effectiveEndDate, month, `${month}%`]
    );

    // Build log lookup map by date
    const dateLogsMap = {};
    logs.forEach(log => {
      if (!dateLogsMap[log.date]) dateLogsMap[log.date] = {};
      dateLogsMap[log.date][log.meal_slot] = log;
    });

    let deliveredLunchCount = 0;
    let deliveredDinnerCount = 0;
    let skippedLunchCount = 0;
    let skippedDinnerCount = 0;
    let totalExtraCharges = 0;
    let totalPerMealCostSum = 0;

    const dailyBreakdown = [];
    let runningCumulativeBill = 0;

    const defaultLunchRate = (customer.rate_lunch && customer.rate_lunch > 0) ? customer.rate_lunch : 80;
    const defaultDinnerRate = (customer.rate_dinner && customer.rate_dinner > 0) ? customer.rate_dinner : 80;
    const custStartDate = customer.start_date || '2000-01-01';

    // Loop day by day from effectiveStartDate to effectiveEndDate
    let curr = new Date(effectiveStartDate + 'T00:00:00');
    const end = new Date(effectiveEndDate + 'T00:00:00');

    let dayCounter = 1;
    while (curr <= end) {
      const fullDate = formatDateLocal(curr);
      const dayNameStr = getDayName(fullDate);
      const isBeforeJoin = fullDate < custStartDate;

      const dayLogs = dateLogsMap[fullDate] || {};
      const lunchLog = dayLogs['Lunch'];
      const dinnerLog = dayLogs['Dinner'];

      const appliedLunch = parseFloat(lunchLog?.applied_lunch_rate);
      const effectiveLunchCost = (!isNaN(appliedLunch) && appliedLunch > 0) ? appliedLunch : defaultLunchRate;

      let lunchStatus = 'Not Logged';
      let lunchCost = 0;

      if (customer.meal_preference === 'Dinner') {
        lunchStatus = 'N/A';
      } else if (lunchLog) {
        lunchStatus = lunchLog.status;
        if (lunchLog.status === 'Delivered') {
          deliveredLunchCount++;
          lunchCost = effectiveLunchCost;
        } else if (lunchLog.status === 'Skipped' || lunchLog.status === 'Cancelled') {
          skippedLunchCount++;
        }
      } else if (isBeforeJoin) {
        lunchStatus = 'Not Started';
      }

      const appliedDinner = parseFloat(dinnerLog?.applied_dinner_rate);
      const effectiveDinnerCost = (!isNaN(appliedDinner) && appliedDinner > 0) ? appliedDinner : defaultDinnerRate;

      let dinnerStatus = 'Not Logged';
      let dinnerCost = 0;

      if (customer.meal_preference === 'Lunch') {
        dinnerStatus = 'N/A';
      } else if (dinnerLog) {
        dinnerStatus = dinnerLog.status;
        if (dinnerLog.status === 'Delivered') {
          deliveredDinnerCount++;
          dinnerCost = effectiveDinnerCost;
        } else if (dinnerLog.status === 'Skipped' || dinnerLog.status === 'Cancelled') {
          skippedDinnerCount++;
        }
      } else if (isBeforeJoin) {
        dinnerStatus = 'Not Started';
      }

      totalPerMealCostSum += (lunchCost + dinnerCost);

      const dayExtraAmount = (lunchLog?.extra_amount || 0) + (dinnerLog?.extra_amount || 0);
      const dayExtraNotes = [lunchLog?.extra_notes, dinnerLog?.extra_notes].filter(Boolean).join('; ');
      totalExtraCharges += dayExtraAmount;

      const dayTotalCost = lunchCost + dinnerCost + dayExtraAmount;
      runningCumulativeBill += dayTotalCost;

      dailyBreakdown.push({
        date: fullDate,
        dayNumber: dayCounter++,
        dayName: dayNameStr,
        isBeforeJoin,
        lunchStatus,
        lunchCost,
        lunchPerMealRate: effectiveLunchCost,
        dinnerStatus,
        dinnerCost,
        dinnerPerMealRate: effectiveDinnerCost,
        extraAmount: dayExtraAmount,
        extraNotes: dayExtraNotes,
        dayTotalCost,
        cumulativeTotal: runningCumulativeBill
      });

      curr.setDate(curr.getDate() + 1);
    }

    let baseBillAmount = 0;
    if (customer.plan_type === 'Monthly') {
      baseBillAmount = customer.monthly_rate;
    } else {
      baseBillAmount = totalPerMealCostSum;
    }

    const totalBillAmount = baseBillAmount + totalExtraCharges;
    
    // Separate direct bill payments (is_advance = 0) vs advance deposits
    const directPayments = payments.filter(p => !p.is_advance).reduce((sum, p) => sum + p.amount, 0);
    const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const advanceBalance = customer.advance_balance || 0;

    // Correct Accounting
    const unpaidAfterDirect = Math.max(0, totalBillAmount - directPayments);
    const advanceApplied = Math.min(unpaidAfterDirect, advanceBalance);
    const netBalanceDue = Math.max(0, unpaidAfterDirect - advanceApplied);
    const remainingAdvanceCredit = Math.max(0, advanceBalance - advanceApplied);

    res.json({
      success: true,
      customer,
      month,
      cyclePeriod: {
        fromDate: effectiveStartDate,
        toDate: effectiveEndDate
      },
      plan_type: customer.plan_type,
      summary: {
        totalDaysInCycle: dailyBreakdown.length,
        deliveredLunchCount,
        deliveredDinnerCount,
        skippedLunchCount,
        skippedDinnerCount,
        baseBillAmount,
        totalExtraCharges,
        totalBillAmount,
        directPayments,
        totalPaymentsReceived,
        advanceBalance,
        advanceApplied,
        netBalanceDue,
        remainingAdvanceCredit
      },
      dailyBreakdown,
      payments
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get billing summary of all active/all customers for a given month
router.get('/summary', async (req, res) => {
  try {
    const { month = formatDateLocal(new Date()).slice(0, 7) } = req.query; // YYYY-MM
    const totalDays = getDaysInMonth(month);
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(totalDays).padStart(2, '0')}`;

    const customers = await getAll(`SELECT * FROM customers WHERE status != 'Inactive' ORDER BY name ASC`);

    const summaryList = [];
    let totalMonthBilled = 0;
    let totalMonthCollected = 0;
    let totalMonthPending = 0;
    let totalAdvanceHeld = 0;

    for (const c of customers) {
      const logs = await getAll(
        `SELECT * FROM daily_logs WHERE customer_id = ? AND date >= ? AND date <= ?`,
        [c.id, startDate, endDate]
      );

      const payments = await getAll(
        `SELECT * FROM payments WHERE customer_id = ? AND (month_year = ? OR payment_date LIKE ?)`,
        [c.id, month, `${month}%`]
      );

      let lunchCount = 0;
      let dinnerCount = 0;
      let extraSum = 0;
      let calculatedMealSum = 0;

      const defL = (c.rate_lunch && c.rate_lunch > 0) ? c.rate_lunch : 80;
      const defD = (c.rate_dinner && c.rate_dinner > 0) ? c.rate_dinner : 80;

      logs.forEach(l => {
        if (l.status === 'Delivered') {
          if (l.meal_slot === 'Lunch') {
            lunchCount++;
            const rL = parseFloat(l.applied_lunch_rate);
            calculatedMealSum += (!isNaN(rL) && rL > 0) ? rL : defL;
          }
          if (l.meal_slot === 'Dinner') {
            dinnerCount++;
            const rD = parseFloat(l.applied_dinner_rate);
            calculatedMealSum += (!isNaN(rD) && rD > 0) ? rD : defD;
          }
        }
        extraSum += (l.extra_amount || 0);
      });

      let baseAmount = 0;
      if (c.plan_type === 'Monthly') {
        baseAmount = c.monthly_rate;
      } else {
        baseAmount = calculatedMealSum;
      }

      const totalBill = baseAmount + extraSum;
      const directPayments = payments.filter(p => !p.is_advance).reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const advance = c.advance_balance || 0;

      const unpaidAfterDirect = Math.max(0, totalBill - directPayments);
      const advanceApplied = Math.min(unpaidAfterDirect, advance);
      const netDue = Math.max(0, unpaidAfterDirect - advanceApplied);

      totalMonthBilled += totalBill;
      totalMonthCollected += totalPaid;
      totalMonthPending += netDue;
      totalAdvanceHeld += advance;

      summaryList.push({
        customer: c,
        lunchCount,
        dinnerCount,
        extraSum,
        totalBill,
        totalPaid,
        advanceBalance: advance,
        advanceApplied,
        netDue
      });
    }

    res.json({
      success: true,
      month,
      totals: {
        totalBilled: totalMonthBilled,
        totalCollected: totalMonthCollected,
        totalPending: totalMonthPending,
        totalAdvanceHeld
      },
      customers: summaryList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
