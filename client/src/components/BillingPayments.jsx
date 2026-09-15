import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Receipt, Calendar, CreditCard, Printer, MessageSquareShare, PlusCircle, CheckCircle, AlertCircle, Trash2, Edit3, Wallet, ArrowDownRight, ArrowUpRight, Filter } from 'lucide-react';

export default function BillingPayments() {
  const [activeTabMode, setActiveTabMode] = useState('summary'); // 'summary' or 'individual'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Custom Date Range State
  const [periodType, setPeriodType] = useState('cycle'); // 'cycle', 'custom', 'month'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Summary Data
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Individual Bill Data
  const [billData, setBillData] = useState(null);
  const [billLoading, setBillLoading] = useState(false);

  // Payment Add/Edit Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({
    customer_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'UPI',
    is_advance: 0,
    notes: ''
  });

  // Printable Receipt Modal
  const [receiptModal, setReceiptModal] = useState({ open: false, payment: null });

  // Settings for receipt header
  const [settings, setSettings] = useState({});

  const billPrintRef = useRef(null);

  const fetchInitialData = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        axios.get('/api/customers?status=All'),
        axios.get('/api/settings')
      ]);
      setCustomers(cRes.data.customers || cRes.data || []);
      setSettings(sRes.data || {});
      if (cRes.data.customers && cRes.data.customers.length > 0) {
        setSelectedCustomerId(cRes.data.customers[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load customers/settings:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch Summary whenever month changes
  const fetchMonthlySummary = async () => {
    try {
      setSummaryLoading(true);
      const res = await axios.get(`/api/billing/summary?month=${selectedMonth}`);
      setMonthlySummary(res.data);
    } catch (err) {
      console.error('Failed to fetch monthly summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTabMode === 'summary') {
      fetchMonthlySummary();
    }
  }, [selectedMonth, activeTabMode]);

  // Fetch Individual Bill whenever selected customer, month, or periodType changes
  const fetchIndividualBill = async () => {
    if (!selectedCustomerId) return;
    try {
      setBillLoading(true);
      let url = `/api/billing/customer/${selectedCustomerId}?month=${selectedMonth}`;
      if (periodType === 'custom' && fromDate && toDate) {
        url += `&fromDate=${fromDate}&toDate=${toDate}`;
      }
      const res = await axios.get(url);
      setBillData(res.data);

      if (periodType === 'cycle' && res.data.cyclePeriod) {
        setFromDate(res.data.cyclePeriod.fromDate);
        setToDate(res.data.cyclePeriod.toDate);
      }
    } catch (err) {
      console.error('Failed to fetch individual bill:', err);
    } finally {
      setBillLoading(false);
    }
  };

  useEffect(() => {
    if (activeTabMode === 'individual' && selectedCustomerId) {
      fetchIndividualBill();
    }
  }, [selectedCustomerId, selectedMonth, periodType, activeTabMode]);

  const handleDirectSlotToggle = async (dateStr, meal_slot, currentStatus) => {
    if (currentStatus === 'N/A' || currentStatus === 'Not Started') return;
    const newStatus = currentStatus === 'Delivered' ? 'Skipped' : 'Delivered';
    try {
      await axios.post('/api/daily-logs/single', {
        customer_id: selectedCustomerId,
        date: dateStr,
        meal_slot,
        status: newStatus,
        extra_amount: 0,
        extra_notes: ''
      });
      fetchIndividualBill();
    } catch (err) {
      console.error('Failed direct log:', err);
    }
  };

  const handleOpenPaymentModal = (customerId = '', isAdvanceMode = false, paymentToEdit = null) => {
    if (paymentToEdit) {
      setEditingPayment(paymentToEdit);
      setPaymentFormData({
        customer_id: paymentToEdit.customer_id,
        amount: paymentToEdit.amount,
        payment_date: paymentToEdit.payment_date,
        payment_mode: paymentToEdit.payment_mode || 'UPI',
        is_advance: paymentToEdit.is_advance ? 1 : 0,
        notes: paymentToEdit.notes || ''
      });
    } else {
      setEditingPayment(null);
      setPaymentFormData({
        customer_id: customerId || selectedCustomerId,
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'UPI',
        is_advance: isAdvanceMode ? 1 : 0,
        notes: isAdvanceMode ? 'Advance Prepayment' : ''
      });
    }
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      if (editingPayment) {
        await axios.put(`/api/payments/${editingPayment.id}`, {
          ...paymentFormData,
          amount: parseFloat(paymentFormData.amount),
          month_year: selectedMonth
        });
      } else {
        await axios.post('/api/payments', {
          ...paymentFormData,
          amount: parseFloat(paymentFormData.amount),
          month_year: selectedMonth
        });
      }
      setPaymentModalOpen(false);
      fetchInitialData();
      if (activeTabMode === 'individual') fetchIndividualBill();
      else fetchMonthlySummary();
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to save payment');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      await axios.delete(`/api/payments/${paymentId}`);
      fetchInitialData();
      if (activeTabMode === 'individual') fetchIndividualBill();
      else fetchMonthlySummary();
    } catch (err) {
      console.error('Failed to delete payment:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsAppLink = (custName, phone, billAmount, paidAmount, advanceBalance, netDue, cycleStr) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `Hello ${custName},\n\n` +
      `*${settings.center_name || 'Adarsh Tiffin Centre'}* - Bill Statement (${cycleStr}):\n` +
      `• Total Month Bill: ₹${billAmount}\n` +
      `• Payments Received: ₹${paidAmount}\n` +
      (advanceBalance > 0 ? `• Advance Credit Applied: ₹${advanceBalance}\n` : '') +
      `-------------------------\n` +
      `*Net Remaining Amount Due: ₹${netDue}*\n\n` +
      (settings.upi_id ? `Pay via UPI: *${settings.upi_id}*\n` : '') +
      `Thank you! 🙏`;

    return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Control Bar: Mode Toggle & Month Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        
        {/* Tab Mode Buttons */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTabMode('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTabMode === 'summary'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Ledger Overview
          </button>
          <button
            onClick={() => setActiveTabMode('individual')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTabMode === 'individual'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Individual Daily Attendance & Billing
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-amber-600" />
          <label className="text-sm font-semibold text-slate-700">Billing Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

      </div>

      {/* MODE 1: MONTHLY LEDGER OVERVIEW */}
      {activeTabMode === 'summary' && (
        <div className="space-y-5 no-print">
          
          {/* Summary Metric Cards */}
          {monthlySummary && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Billed ({selectedMonth})</p>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-1">₹{monthlySummary.totals.totalBilled}</h3>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Payments Received</p>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">₹{monthlySummary.totals.totalCollected}</h3>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Advance Credit Held</p>
                <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">₹{monthlySummary.totals.totalAdvanceHeld}</h3>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase">Net Remaining Dues</p>
                <h3 className="text-2xl font-extrabold text-rose-600 mt-1">₹{monthlySummary.totals.totalPending}</h3>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          {summaryLoading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : !monthlySummary?.customers?.length ? (
            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
              No customer statements found for {selectedMonth}.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4 text-center">Food Attendance (L / D)</th>
                      <th className="py-3 px-4 text-right">Total Bill</th>
                      <th className="py-3 px-4 text-right">Paid</th>
                      <th className="py-3 px-4 text-right">Advance Balance</th>
                      <th className="py-3 px-4 text-right">Net Remaining Due</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {monthlySummary.customers.map((item) => {
                      const { customer, lunchCount, dinnerCount, totalBill, totalPaid, advanceBalance, netDue } = item;
                      const waLink = generateWhatsAppLink(customer.name, customer.phone, totalBill, totalPaid, advanceBalance, netDue, selectedMonth);

                      return (
                        <tr key={customer.id} className="hover:bg-slate-50/80 transition-all">
                          
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            <div>{customer.name}</div>
                            <div className="text-xs text-slate-500">{customer.phone} • Join: {customer.start_date || 'N/A'}</div>
                          </td>

                          <td className="py-3.5 px-4 text-center text-xs">
                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">☀️ {lunchCount}</span>
                            <span className="mx-1 text-slate-300">|</span>
                            <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">🌙 {dinnerCount}</span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                            ₹{totalBill}
                          </td>

                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                            ₹{totalPaid}
                          </td>

                          <td className="py-3.5 px-4 text-right font-semibold text-indigo-600">
                            {advanceBalance > 0 ? `₹${advanceBalance}` : '-'}
                          </td>

                          <td className="py-3.5 px-4 text-right font-extrabold">
                            <span className={netDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              ₹{netDue}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              
                              {/* Record Payment / Advance Button */}
                              <button
                                onClick={() => handleOpenPaymentModal(customer.id)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded flex items-center space-x-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>

                              {/* WhatsApp Share Link */}
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1 rounded flex items-center space-x-1 shadow-sm"
                                title="Send Bill on WhatsApp"
                              >
                                <MessageSquareShare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>

                              {/* View Statement Button */}
                              <button
                                onClick={() => {
                                  setSelectedCustomerId(customer.id.toString());
                                  setActiveTabMode('individual');
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2 py-1 rounded"
                                title="View Daily Attendance & Bill"
                              >
                                Daily Breakdown
                              </button>

                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODE 2: INDIVIDUAL DAILY FOOD ATTENDANCE & BILLING BREAKDOWN */}
      {activeTabMode === 'individual' && (
        <div className="space-y-6">
          
          {/* Customer Dropdown, Billing Period Selector & Quick Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
            
            {/* Customer Dropdown & Period Mode Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Select Customer:</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full sm:w-60 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Billing Cycle Type:</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="w-full sm:w-56 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="cycle">1-Month Join Cycle (Join Date ➔ Next Month)</option>
                  <option value="custom">Custom Date Range (From ➔ To)</option>
                  <option value="month">Calendar Month Boundary</option>
                </select>
              </div>

              {/* Custom Date Inputs if PeriodType is custom or cycle */}
              {(periodType === 'custom' || periodType === 'cycle') && (
                <div className="flex items-center space-x-2 pt-4 sm:pt-0">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">From:</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setPeriodType('custom');
                        setFromDate(e.target.value);
                      }}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">To:</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setPeriodType('custom');
                        setToDate(e.target.value);
                      }}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
              <button
                onClick={() => handleOpenPaymentModal(selectedCustomerId, true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center space-x-1 border border-indigo-200 shadow-sm"
              >
                <Wallet className="w-4 h-4 text-indigo-600" />
                <span>Add Advance Money</span>
              </button>

              <button
                onClick={() => handleOpenPaymentModal(selectedCustomerId, false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Record Bill Payment</span>
              </button>

              <button
                onClick={handlePrint}
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3.5 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Statement</span>
              </button>
            </div>

          </div>

          {/* Printable Invoice Container */}
          {billLoading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : !billData ? (
            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
              Please select a customer to view daily attendance statement.
            </div>
          ) : (
            <div ref={billPrintRef} className="printable-bill bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-md space-y-6 max-w-5xl mx-auto">
              
              {/* Receipt Branding Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-amber-600 uppercase tracking-wide">
                    {settings.center_name || 'Adarsh Tiffin Centre'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">{settings.address || 'Quality Home-Cooked Tiffins'}</p>
                  <p className="text-xs text-slate-500">Phone: {settings.owner_phone || '9876543210'}</p>
                  {settings.upi_id && (
                    <p className="text-xs font-semibold text-emerald-700 mt-1">UPI ID: {settings.upi_id}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    Daily Food Attendance & Statement
                  </span>
                  <p className="text-sm font-bold text-slate-700 mt-2">
                    Billing Period: {billData.cyclePeriod?.fromDate} to {billData.cyclePeriod?.toDate}
                  </p>
                  <p className="text-xs text-slate-400">Generated: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Customer Profile Box & Metric Overview */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] text-slate-400 uppercase font-bold">Customer Info</p>
                  <h4 className="text-base font-bold text-slate-800">{billData.customer.name}</h4>
                  <p className="text-xs text-slate-600">Mobile: {billData.customer.phone}</p>
                  <p className="text-xs text-slate-600">Join Date: <strong className="text-slate-700">{billData.customer.start_date || 'N/A'}</strong></p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 uppercase font-bold">Plan & Diet</p>
                  <p className="text-xs font-bold text-slate-800">{billData.customer.plan_type === 'Monthly' ? `Fixed Monthly (₹${billData.customer.monthly_rate})` : 'Per Meal Daily Billing'}</p>
                  <p className="text-xs text-slate-600">Diet: {billData.customer.diet_type}</p>
                  <p className="text-xs text-slate-600">Preference: {billData.customer.meal_preference}</p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 uppercase font-bold">Attendance Summary</p>
                  <div className="text-xs font-semibold space-y-0.5 mt-0.5">
                    <p className="text-amber-700">☀️ Lunch Delivered: <span className="font-bold">{billData.summary.deliveredLunchCount} days</span></p>
                    <p className="text-indigo-700">🌙 Dinner Delivered: <span className="font-bold">{billData.summary.deliveredDinnerCount} days</span></p>
                    <p className="text-slate-500">Skipped/Leave: {billData.summary.skippedLunchCount + billData.summary.skippedDinnerCount} meals</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase font-bold">Net Remaining Due</p>
                    <h3 className={`text-2xl font-black ${billData.summary.netBalanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{billData.summary.netBalanceDue}
                    </h3>
                  </div>
                  {billData.summary.advanceBalance > 0 && (
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      Available Advance: ₹{billData.summary.advanceBalance}
                    </p>
                  )}
                </div>
              </div>

              {/* Day-by-Day Daily Food Attendance & Billing Breakdown Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800">
                    Daily Attendance & Food Billing Sheet ({billData.cyclePeriod?.fromDate} to {billData.cyclePeriod?.toDate})
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    Total Days: {billData.summary.totalDaysInCycle} • <span className="text-amber-600 font-semibold">Tip: Click "Not Logged" badge to 1-click mark delivered!</span>
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">Date & Day</th>
                        <th className="py-2.5 px-3 text-center">Lunch Slot ☀️ {billData.customer?.rate_lunch > 0 ? `(₹${billData.customer.rate_lunch})` : ''}</th>
                        <th className="py-2.5 px-3 text-center">Dinner Slot 🌙 {billData.customer?.rate_dinner > 0 ? `(₹${billData.customer.rate_dinner})` : ''}</th>
                        <th className="py-2.5 px-3 text-right">Extra Items</th>
                        <th className="py-2.5 px-3 text-right">Day Billing Total</th>
                        <th className="py-2.5 px-3 text-right">Cumulative Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {billData.dailyBreakdown.map((row) => {
                        const lunchDisplayRate = row.lunchCost > 0 ? row.lunchCost : (row.lunchPerMealRate || billData.customer?.rate_lunch || 80);
                        const dinnerDisplayRate = row.dinnerCost > 0 ? row.dinnerCost : (row.dinnerPerMealRate || billData.customer?.rate_dinner || 80);

                        return (
                        <tr key={row.date} className={`hover:bg-slate-50 ${row.dayName === 'Sun' ? 'bg-amber-50/30' : ''}`}>
                          
                          {/* Date & Day */}
                          <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                            <span className="font-bold">{row.date}</span> <span className="text-slate-400">({row.dayName})</span>
                          </td>

                          {/* Lunch Slot (1-Click Toggleable!) */}
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleDirectSlotToggle(row.date, 'Lunch', row.lunchStatus)}
                              disabled={row.lunchStatus === 'N/A' || row.lunchStatus === 'Not Started'}
                              title={row.lunchStatus === 'N/A' || row.lunchStatus === 'Not Started' ? '' : 'Click to toggle Delivered / Skipped'}
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                row.lunchStatus === 'Delivered'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer'
                                  : row.lunchStatus === 'Skipped'
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer'
                                  : row.lunchStatus === 'Not Started'
                                  ? 'bg-slate-100 text-slate-400 italic cursor-not-allowed'
                                  : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-900 cursor-pointer'
                              }`}
                            >
                              {row.lunchStatus} {row.lunchStatus === 'N/A' || row.lunchStatus === 'Not Started' ? '' : `(₹${lunchDisplayRate})`}
                            </button>
                          </td>

                          {/* Dinner Slot (1-Click Toggleable!) */}
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleDirectSlotToggle(row.date, 'Dinner', row.dinnerStatus)}
                              disabled={row.dinnerStatus === 'N/A' || row.dinnerStatus === 'Not Started'}
                              title={row.dinnerStatus === 'N/A' || row.dinnerStatus === 'Not Started' ? '' : 'Click to toggle Delivered / Skipped'}
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                row.dinnerStatus === 'Delivered'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer'
                                  : row.dinnerStatus === 'Skipped'
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer'
                                  : row.dinnerStatus === 'Not Started'
                                  ? 'bg-slate-100 text-slate-400 italic cursor-not-allowed'
                                  : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-900 cursor-pointer'
                              }`}
                            >
                              {row.dinnerStatus} {row.dinnerStatus === 'N/A' || row.dinnerStatus === 'Not Started' ? '' : `(₹${dinnerDisplayRate})`}
                            </button>
                          </td>

                          {/* Extra Items */}
                          <td className="py-2 px-3 text-right">
                            {row.extraAmount > 0 ? (
                              <span className="font-semibold text-amber-700">
                                +₹{row.extraAmount} <span className="text-[10px] text-slate-400 font-normal">({row.extraNotes})</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Day Billing Total */}
                          <td className="py-2 px-3 text-right font-bold text-slate-800">
                            ₹{row.dayTotalCost}
                          </td>

                          {/* Cumulative Running Bill */}
                          <td className="py-2 px-3 text-right font-semibold text-slate-500">
                            ₹{row.cumulativeTotal}
                          </td>

                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation & Prepayments Summary Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                
                {/* Payments & Advance Deposits History */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2">Payments & Advance Deposits Log</h4>
                  {billData.payments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No payments recorded for this cycle period yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {billData.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-xs border border-slate-100">
                          <div>
                            <span className="font-semibold text-slate-800">₹{p.amount}</span>
                            <span className="text-slate-500 ml-2">({p.payment_mode} • {p.payment_date})</span>
                            {p.is_advance === 1 && (
                              <span className="ml-2 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Advance Deposit
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 no-print">
                            <button
                              onClick={() => setReceiptModal({ open: true, payment: { ...p, customer_name: billData.customer.name, customer_phone: billData.customer.phone } })}
                              className="p-1 text-slate-600 hover:text-amber-600 rounded"
                              title="Print Payment Receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenPaymentModal('', false, p)}
                              className="p-1 text-slate-600 hover:text-indigo-600 rounded"
                              title="Edit Payment Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 rounded"
                              title="Delete Payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Bill Calculation Box */}
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Tiffin Charge ({billData.summary.deliveredLunchCount + billData.summary.deliveredDinnerCount} meals):</span>
                    <span className="font-semibold">₹{billData.summary.baseBillAmount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Extra Add-ons Total:</span>
                    <span className="font-semibold">₹{billData.summary.totalExtraCharges}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-amber-200">
                    <span>Total Cycle Bill Amount:</span>
                    <span>₹{billData.summary.totalBillAmount}</span>
                  </div>
                  {billData.summary.directPayments > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Direct Bill Payments Received:</span>
                      <span>- ₹{billData.summary.directPayments}</span>
                    </div>
                  )}
                  {billData.summary.advanceApplied > 0 && (
                    <div className="flex justify-between text-indigo-700 font-semibold">
                      <span>Advance Credit Applied:</span>
                      <span>- ₹{billData.summary.advanceApplied}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-base pt-2 border-t border-amber-300 text-slate-900">
                    <span>Net Remaining Amount Due:</span>
                    <span className={billData.summary.netBalanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      ₹{billData.summary.netBalanceDue}
                    </span>
                  </div>
                  {billData.summary.remainingAdvanceCredit > 0 && (
                    <div className="flex justify-between text-xs text-indigo-600 font-medium pt-1">
                      <span>Remaining Advance Credit for Next Month:</span>
                      <span>₹{billData.summary.remainingAdvanceCredit}</span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* Record / Edit Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              {editingPayment ? 'Edit Payment Record' : (paymentFormData.is_advance ? 'Record Advance Money Prepayment' : 'Record Customer Payment')}
            </h3>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Customer</label>
                <select
                  required
                  disabled={!!editingPayment}
                  value={paymentFormData.customer_id}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, customer_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  placeholder="e.g. 1500"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentFormData.payment_date}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                  <select
                    value={paymentFormData.payment_mode}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_mode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Is Advance Prepayment Checkbox */}
              <div className="flex items-center space-x-2 bg-indigo-50/70 p-3 rounded-lg border border-indigo-200">
                <input
                  type="checkbox"
                  id="is_advance"
                  checked={paymentFormData.is_advance === 1}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, is_advance: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_advance" className="text-xs font-semibold text-indigo-900 cursor-pointer">
                  Mark as Advance Money / Prepayment (Add to customer credit balance)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Transaction Ref ID</label>
                <input
                  type="text"
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  placeholder="e.g. UTR #12345678"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                >
                  {editingPayment ? 'Update Payment' : 'Save Payment'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Printable Payment Receipt Modal */}
      {receiptModal.open && receiptModal.payment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border border-slate-300 p-5 rounded-lg space-y-4 bg-white" id="single-receipt">
              <div className="text-center border-b border-slate-200 pb-3">
                <h3 className="font-black text-lg text-amber-600 uppercase">{settings.center_name || 'Adarsh Tiffin Centre'}</h3>
                <p className="text-xs text-slate-500">{settings.address || 'Quality Home Tiffins'}</p>
                <p className="text-xs text-slate-500">Phone: {settings.owner_phone || '9876543210'}</p>
              </div>

              <div className="text-center">
                <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1 rounded-full uppercase">
                  Payment Receipt #{receiptModal.payment.id}
                </span>
              </div>

              <div className="text-xs space-y-1.5 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Name:</span>
                  <span className="font-bold text-slate-800">{receiptModal.payment.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Date:</span>
                  <span className="font-semibold text-slate-800">{receiptModal.payment.payment_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-semibold text-slate-800">{receiptModal.payment.payment_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deposit Type:</span>
                  <span className="font-semibold text-slate-800">{receiptModal.payment.is_advance ? 'Advance Deposit' : 'Bill Payment'}</span>
                </div>
                {receiptModal.payment.notes && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Notes / Ref ID:</span>
                    <span className="font-semibold text-slate-800">{receiptModal.payment.notes}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Amount Paid:</span>
                  <span className="text-emerald-600">₹{receiptModal.payment.amount}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                Thank you for your prompt payment! 🙏
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setReceiptModal({ open: false, payment: null })}
                className="px-3 py-1.5 rounded text-xs bg-slate-200 text-slate-700 font-bold hover:bg-slate-300"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-1.5 rounded text-xs bg-slate-800 text-white font-bold hover:bg-slate-900 flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
