import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Download, Printer, Filter, TrendingUp, Users, Truck, Calendar } from 'lucide-react';

export default function Reports() {
  const [reportType, setReportType] = useState('billing'); // 'billing' | 'customer' | 'delivery'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [dietFilter, setDietFilter] = useState('All');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const url = `/api/reports?type=${reportType}&month=${selectedMonth}&status=${statusFilter}&plan_type=${planFilter}&diet_type=${dietFilter}`;
      const res = await axios.get(url);
      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedMonth, statusFilter, planFilter, dietFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    const headers = Object.keys(reportData.rows[0]);
    csvContent += headers.join(',') + '\n';

    reportData.rows.forEach((row) => {
      const rowValues = headers.map((h) => `"${row[h] ?? ''}"`);
      csvContent += rowValues.join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `adarsh_tiffin_${reportType}_report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Business Reports & Analytics</h2>
            <p className="text-xs text-slate-500 mt-0.5">Generate, filter, print, and export CSV reports for billing, customers, and daily deliveries</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Report Category:</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="billing">💰 Billing & Collections Summary</option>
              <option value="customer">👥 Customer Directory Report</option>
              <option value="delivery">🚚 Meal Delivery & Skip Counts</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Paused">Paused Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Plan Type:</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="All">All Plans</option>
              <option value="PerMeal">Per Meal Daily Rate</option>
              <option value="Monthly">Fixed Monthly Pkg</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Diet Preference:</label>
            <select
              value={dietFilter}
              onChange={(e) => setDietFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="All">All Diets</option>
              <option value="Veg">Veg</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Jain">Jain</option>
            </select>
          </div>

        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      ) : !reportData || !reportData.rows ? (
        <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
          No report data found.
        </div>
      ) : (
        <div className="printable-report bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
          
          {/* Report Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {reportType === 'billing' && 'Monthly Billing & Collections Statement'}
                {reportType === 'customer' && 'Customer Master Register'}
                {reportType === 'delivery' && 'Meal Dispatch & Delivery Breakdown'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">Period: {selectedMonth} | Filters: Status ({statusFilter}), Plan ({planFilter}), Diet ({dietFilter})</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Generated on {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Metric Summary Cards */}
          {reportType === 'billing' && reportData.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-800 font-semibold uppercase">Total Billed</p>
                <h3 className="text-xl font-extrabold text-amber-950 mt-1">₹{reportData.totals.grandTotalBilled}</h3>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <p className="text-xs text-emerald-800 font-semibold uppercase">Total Collected</p>
                <h3 className="text-xl font-extrabold text-emerald-950 mt-1">₹{reportData.totals.grandTotalPaid}</h3>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <p className="text-xs text-indigo-800 font-semibold uppercase">Advance Balances Held</p>
                <h3 className="text-xl font-extrabold text-indigo-950 mt-1">₹{reportData.totals.grandTotalAdvance}</h3>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                <p className="text-xs text-rose-800 font-semibold uppercase">Net Dues Pending</p>
                <h3 className="text-xl font-extrabold text-rose-950 mt-1">₹{reportData.totals.grandTotalPending}</h3>
              </div>
            </div>
          )}

          {reportType === 'delivery' && reportData.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-800 font-semibold uppercase">Lunch Delivered ☀️</p>
                <h3 className="text-xl font-extrabold text-amber-950 mt-1">{reportData.totals.totalLunchDelivered} meals</h3>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <p className="text-xs text-indigo-800 font-semibold uppercase">Dinner Delivered 🌙</p>
                <h3 className="text-xl font-extrabold text-indigo-950 mt-1">{reportData.totals.totalDinnerDelivered} meals</h3>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <p className="text-xs text-emerald-800 font-semibold uppercase">Total Meals Served</p>
                <h3 className="text-xl font-extrabold text-emerald-950 mt-1">{reportData.totals.totalMealsDelivered}</h3>
              </div>
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Skipped / On Leave</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">{reportData.totals.totalSkipped}</h3>
              </div>
            </div>
          )}

          {reportType === 'customer' && reportData.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Total Customers</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">{reportData.totals.totalCustomers}</h3>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <p className="text-xs text-emerald-800 font-semibold uppercase">Active Customers</p>
                <h3 className="text-xl font-extrabold text-emerald-950 mt-1">{reportData.totals.activeCount}</h3>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-800 font-semibold uppercase">Paused Customers</p>
                <h3 className="text-xl font-extrabold text-amber-950 mt-1">{reportData.totals.pausedCount}</h3>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <p className="text-xs text-indigo-800 font-semibold uppercase">Total Advance Held</p>
                <h3 className="text-xl font-extrabold text-indigo-950 mt-1">₹{reportData.totals.totalAdvance}</h3>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Mobile Phone</th>
                  {reportType === 'billing' && (
                    <>
                      <th className="py-2.5 px-3 text-center">Meals (L/D)</th>
                      <th className="py-2.5 px-3 text-right">Total Bill</th>
                      <th className="py-2.5 px-3 text-right">Paid</th>
                      <th className="py-2.5 px-3 text-right">Advance Credit</th>
                      <th className="py-2.5 px-3 text-right">Net Remaining Due</th>
                    </>
                  )}
                  {reportType === 'customer' && (
                    <>
                      <th className="py-2.5 px-3">Address</th>
                      <th className="py-2.5 px-3">Plan / Diet</th>
                      <th className="py-2.5 px-3">Joined Date</th>
                      <th className="py-2.5 px-3 text-right">Advance Balance</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </>
                  )}
                  {reportType === 'delivery' && (
                    <>
                      <th className="py-2.5 px-3">Preference / Diet</th>
                      <th className="py-2.5 px-3 text-center">Lunch Delivered</th>
                      <th className="py-2.5 px-3 text-center">Dinner Delivered</th>
                      <th className="py-2.5 px-3 text-center">Skipped / Leave</th>
                      <th className="py-2.5 px-3 text-center">Total Delivered</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.rows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{row.name}</td>
                    <td className="py-2 px-3 text-slate-600">{row.phone}</td>
                    
                    {reportType === 'billing' && (
                      <>
                        <td className="py-2 px-3 text-center">
                          <span className="text-amber-700 font-bold">☀️ {row.lunchCount}</span> | <span className="text-indigo-700 font-bold">🌙 {row.dinnerCount}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">₹{row.totalBill}</td>
                        <td className="py-2 px-3 text-right font-semibold text-emerald-600">₹{row.totalPaid}</td>
                        <td className="py-2 px-3 text-right text-indigo-600">{row.advanceBalance > 0 ? `₹${row.advanceBalance}` : '-'}</td>
                        <td className="py-2 px-3 text-right font-extrabold">
                          <span className={row.netDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            ₹{row.netDue}
                          </span>
                        </td>
                      </>
                    )}

                    {reportType === 'customer' && (
                      <>
                        <td className="py-2 px-3 text-slate-600">{row.address || 'N/A'}</td>
                        <td className="py-2 px-3 text-slate-700">{row.plan_type} ({row.diet_type})</td>
                        <td className="py-2 px-3 text-slate-600">{row.start_date || 'N/A'}</td>
                        <td className="py-2 px-3 text-right font-semibold text-indigo-600">{row.advance_balance > 0 ? `₹${row.advance_balance}` : '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </>
                    )}

                    {reportType === 'delivery' && (
                      <>
                        <td className="py-2 px-3 text-slate-700">{row.meal_preference} ({row.diet_type})</td>
                        <td className="py-2 px-3 text-center font-semibold text-amber-700">{row.lunchCount}</td>
                        <td className="py-2 px-3 text-center font-semibold text-indigo-700">{row.dinnerCount}</td>
                        <td className="py-2 px-3 text-center text-slate-500">{row.skipCount}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">{row.totalDelivered}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
