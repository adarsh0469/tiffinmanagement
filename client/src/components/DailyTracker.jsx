import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Search, CheckCircle, XCircle, PlusCircle, Sun, Moon, RefreshCw, Clock, Lock, Unlock, AlertTriangle, Palmtree } from 'lucide-react';

export default function DailyTracker() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [logsData, setLogsData] = useState([]);
  const [closedDay, setClosedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Extra modal state
  const [extraModal, setExtraModal] = useState({ open: false, customer: null, meal_slot: 'Lunch', amount: 0, notes: '' });

  // Batch action modal state
  const [batchModal, setBatchModal] = useState({ open: false, meal_slot: 'Lunch', count: 0 });

  // Close / Lock Day Modal State
  const [lockModal, setLockModal] = useState({ open: false, reason: 'Sunday Holiday / Centre Closed' });

  // Manual Past Delivery Modal State
  const [manualModal, setManualModal] = useState({
    open: false,
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    meal_slot: 'Both',
    status: 'Delivered',
    extra_amount: 0,
    extra_notes: ''
  });

  const fetchLogs = async (dateStr) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/daily-logs?date=${dateStr}`);
      setLogsData(res.data.logs || []);
      setClosedDay(res.data.closedDay || null);
    } catch (err) {
      console.error('Error loading daily logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(selectedDate);
  }, [selectedDate]);

  const handleStatusToggle = async (customer_id, meal_slot, currentStatus) => {
    const statusCycle = {
      'Delivered': 'Skipped',
      'Skipped': 'Cancelled',
      'Cancelled': 'Delivered'
    };
    const newStatus = statusCycle[currentStatus] || 'Delivered';

    const item = logsData.find(d => d.customer.id === customer_id);
    const existingLog = meal_slot === 'Lunch' ? item?.lunch : item?.dinner;

    try {
      await axios.post('/api/daily-logs/single', {
        customer_id,
        date: selectedDate,
        meal_slot,
        status: newStatus,
        extra_amount: existingLog?.extra_amount || 0,
        extra_notes: existingLog?.extra_notes || ''
      });
      
      setLogsData(prev => prev.map(item => {
        if (item.customer.id === customer_id) {
          const updatedSlot = {
            ...(meal_slot === 'Lunch' ? item.lunch : item.dinner),
            status: newStatus
          };
          return meal_slot === 'Lunch' ? { ...item, lunch: updatedSlot } : { ...item, dinner: updatedSlot };
        }
        return item;
      }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleOpenBatchModal = (meal_slot) => {
    // Count active eligible customers
    const eligibleCount = logsData.filter(d => {
      if (d.isOnLeave || d.customer.status !== 'Active') return false;
      if (meal_slot === 'Lunch') return d.customer.meal_preference === 'Both' || d.customer.meal_preference === 'Lunch';
      if (meal_slot === 'Dinner') return d.customer.meal_preference === 'Both' || d.customer.meal_preference === 'Dinner';
      return false;
    }).length;

    setBatchModal({ open: true, meal_slot, count: eligibleCount });
  };

  const handleConfirmBatch = async () => {
    try {
      setLoading(true);
      await axios.post('/api/daily-logs/batch', {
        date: selectedDate,
        meal_slot: batchModal.meal_slot,
        status: 'Delivered'
      });
      setBatchModal({ open: false, meal_slot: 'Lunch', count: 0 });
      await fetchLogs(selectedDate);
    } catch (err) {
      console.error('Failed batch mark:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLockDay = async () => {
    try {
      await axios.post('/api/closed-days', {
        date: selectedDate,
        reason: lockModal.reason,
        closed_by: 'Owner'
      });
      setLockModal({ open: false, reason: '' });
      fetchLogs(selectedDate);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to lock day');
    }
  };

  const handleUnlockDay = async () => {
    if (!window.confirm(`Unlock date ${selectedDate}?`)) return;
    try {
      await axios.delete(`/api/closed-days/${selectedDate}`);
      fetchLogs(selectedDate);
    } catch (err) {
      console.error('Failed to unlock day:', err);
    }
  };

  const handleSaveExtra = async () => {
    if (!extraModal.customer) return;
    try {
      await axios.post('/api/daily-logs/single', {
        customer_id: extraModal.customer.id,
        date: selectedDate,
        meal_slot: extraModal.meal_slot,
        status: extraModal.currentStatus || 'Delivered',
        extra_amount: parseFloat(extraModal.amount) || 0,
        extra_notes: extraModal.notes
      });
      setExtraModal({ open: false, customer: null, meal_slot: 'Lunch', amount: 0, notes: '' });
      fetchLogs(selectedDate);
    } catch (err) {
      console.error('Failed to save extra add-on:', err);
    }
  };

  const handleSaveManualLog = async (e) => {
    e.preventDefault();
    if (!manualModal.customer_id || !manualModal.date) return;
    try {
      if (manualModal.meal_slot === 'Both' || manualModal.meal_slot === 'Lunch') {
        await axios.post('/api/daily-logs/single', {
          customer_id: manualModal.customer_id,
          date: manualModal.date,
          meal_slot: 'Lunch',
          status: manualModal.status,
          extra_amount: parseFloat(manualModal.extra_amount) || 0,
          extra_notes: manualModal.extra_notes
        });
      }
      if (manualModal.meal_slot === 'Both' || manualModal.meal_slot === 'Dinner') {
        await axios.post('/api/daily-logs/single', {
          customer_id: manualModal.customer_id,
          date: manualModal.date,
          meal_slot: 'Dinner',
          status: manualModal.status,
          extra_amount: manualModal.meal_slot === 'Both' ? 0 : (parseFloat(manualModal.extra_amount) || 0),
          extra_notes: manualModal.meal_slot === 'Both' ? '' : manualModal.extra_notes
        });
      }
      setManualModal({ open: false, customer_id: '', date: selectedDate, meal_slot: 'Both', status: 'Delivered', extra_amount: 0, extra_notes: '' });
      fetchLogs(selectedDate);
    } catch (err) {
      alert('Failed to save manual delivery record');
    }
  };

  const filteredLogs = logsData.filter(item => 
    item.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customer.phone.includes(searchTerm) ||
    (item.customer.address && item.customer.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Date Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Date Selector */}
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-amber-600" />
          <label className="text-sm font-semibold text-slate-700">Dispatch Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          <button
            onClick={() => fetchLogs(selectedDate)}
            className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Batch & Lock Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {closedDay ? (
            <button
              onClick={handleUnlockDay}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Unlock className="w-4 h-4" />
              <span>Unlock Day</span>
            </button>
          ) : (
            <button
              onClick={() => setLockModal({ open: true, reason: 'Centre Holiday' })}
              className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            >
              <Lock className="w-4 h-4 text-rose-600" />
              <span>Lock / Close Day</span>
            </button>
          )}

          <button
            onClick={() => setManualModal({ ...manualModal, open: true, date: selectedDate })}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Log Custom Date Delivery</span>
          </button>

          <button
            onClick={() => handleOpenBatchModal('Lunch')}
            className="flex items-center space-x-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-amber-300"
          >
            <Sun className="w-4 h-4 text-amber-600" />
            <span>Mark All Lunch Delivered</span>
          </button>
          
          <button
            onClick={() => handleOpenBatchModal('Dinner')}
            className="flex items-center space-x-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-indigo-300"
          >
            <Moon className="w-4 h-4 text-indigo-600" />
            <span>Mark All Dinner Delivered</span>
          </button>
        </div>

      </div>

      {/* Closed Day Alert Banner */}
      {closedDay && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-sm font-bold">This Day is Locked / Centre Closed ({closedDay.date})</p>
              <p className="text-xs text-rose-700 mt-0.5">Reason: {closedDay.reason || 'Holiday'}. Tiffin deliveries are paused for today.</p>
            </div>
          </div>
          <button
            onClick={handleUnlockDay}
            className="bg-white hover:bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-300 shadow-sm"
          >
            Unlock Now
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search customer by name, mobile number, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
        />
      </div>

      {/* Customers Delivery Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
          No active customers found for this date.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Plan & Diet</th>
                  <th className="py-3 px-4 text-center">Lunch Slot ☀️</th>
                  <th className="py-3 px-4 text-center">Dinner Slot 🌙</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map(({ customer, isOnLeave, lunch, dinner }) => (
                  <tr key={customer.id} className={`hover:bg-slate-50/80 transition-all ${isOnLeave ? 'bg-amber-50/40' : ''}`}>
                    
                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-800">{customer.name}</span>
                        {isOnLeave && (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <Palmtree className="w-3 h-3 text-indigo-600" />
                            <span>On Leave</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{customer.phone} {customer.address ? `• ${customer.address}` : ''}</div>
                    </td>

                    {/* Diet & Plan Tag */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          customer.diet_type === 'Non-Veg' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {customer.diet_type}
                        </span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {customer.plan_type === 'Monthly' ? 'Monthly Pkg' : 'Daily Rate'}
                        </span>
                      </div>
                    </td>

                    {/* Lunch Status */}
                    <td className="py-3.5 px-4 text-center">
                      {customer.meal_preference === 'Dinner' ? (
                        <span className="text-xs text-slate-400 italic">Not Subscribed</span>
                      ) : (
                        <div className="flex flex-col items-center space-y-1">
                          <button
                            onClick={() => handleStatusToggle(customer.id, 'Lunch', lunch.status)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 transition-all ${
                              lunch.status === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : lunch.status === 'Skipped'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {lunch.status === 'Delivered' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                            {lunch.status === 'Skipped' && <XCircle className="w-3.5 h-3.5 text-amber-600" />}
                            <span>{lunch.status}</span>
                          </button>

                          {/* Extra Item indicator / Add button */}
                          <button
                            onClick={() => setExtraModal({
                              open: true,
                              customer,
                              meal_slot: 'Lunch',
                              currentStatus: lunch.status,
                              amount: lunch.extra_amount || 0,
                              notes: lunch.extra_notes || ''
                            })}
                            className="text-[11px] text-slate-500 hover:text-amber-600 flex items-center space-x-0.5"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>{lunch.extra_amount > 0 ? `+₹${lunch.extra_amount} (${lunch.extra_notes})` : 'Add Extra'}</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Dinner Status */}
                    <td className="py-3.5 px-4 text-center">
                      {customer.meal_preference === 'Lunch' ? (
                        <span className="text-xs text-slate-400 italic">Not Subscribed</span>
                      ) : (
                        <div className="flex flex-col items-center space-y-1">
                          <button
                            onClick={() => handleStatusToggle(customer.id, 'Dinner', dinner.status)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 transition-all ${
                              dinner.status === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : dinner.status === 'Skipped'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {dinner.status === 'Delivered' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                            {dinner.status === 'Skipped' && <XCircle className="w-3.5 h-3.5 text-amber-600" />}
                            <span>{dinner.status}</span>
                          </button>

                          {/* Extra Item indicator / Add button */}
                          <button
                            onClick={() => setExtraModal({
                              open: true,
                              customer,
                              meal_slot: 'Dinner',
                              currentStatus: dinner.status,
                              amount: dinner.extra_amount || 0,
                              notes: dinner.extra_notes || ''
                            })}
                            className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center space-x-0.5"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>{dinner.extra_amount > 0 ? `+₹${dinner.extra_amount} (${dinner.extra_notes})` : 'Add Extra'}</span>
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {batchModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Confirm Batch Action
            </h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to mark <strong className="text-slate-900">{batchModal.count} active customers</strong> as <span className="text-emerald-700 font-bold">DELIVERED</span> for <strong className="text-amber-600">{batchModal.meal_slot}</strong> on <strong className="text-slate-900">{selectedDate}</strong>?
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setBatchModal({ open: false, meal_slot: 'Lunch', count: 0 })}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBatch}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm"
              >
                Confirm Batch Deliveries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Day Modal */}
      {lockModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Lock / Close Centre for {selectedDate}
            </h3>
            <p className="text-xs text-slate-500">
              Locking this date will mark all active customer meals as Skipped with the specified reason and prevent accidental logging.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Closure Reason:</label>
              <input
                type="text"
                value={lockModal.reason}
                onChange={(e) => setLockModal({ ...lockModal, reason: e.target.value })}
                placeholder="e.g. Sunday Holiday, Festival, Emergency Maintenance"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setLockModal({ open: false, reason: '' })}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLockDay}
                className="px-4 py-2 rounded-lg text-sm bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
              >
                Lock Date Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual / Past Date Delivery Logger Modal */}
      {manualModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Manually Log Tiffin Delivery for Any Date</h3>

            <form onSubmit={handleSaveManualLog} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Customer *</label>
                <select
                  required
                  value={manualModal.customer_id}
                  onChange={(e) => setManualModal({ ...manualModal, customer_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- Select Customer --</option>
                  {logsData.map(d => (
                    <option key={d.customer.id} value={d.customer.id}>
                      {d.customer.name} ({d.customer.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Date *</label>
                <input
                  type="date"
                  required
                  value={manualModal.date}
                  onChange={(e) => setManualModal({ ...manualModal, date: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Meal Slot</label>
                  <select
                    value={manualModal.meal_slot}
                    onChange={(e) => setManualModal({ ...manualModal, meal_slot: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Both">Both (Lunch & Dinner)</option>
                    <option value="Lunch">Lunch Only</option>
                    <option value="Dinner">Dinner Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={manualModal.status}
                    onChange={(e) => setManualModal({ ...manualModal, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Delivered">Delivered 🟢</option>
                    <option value="Skipped">Skipped / On Leave 🟡</option>
                    <option value="Cancelled">Cancelled 🔴</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Extra Amount (₹)</label>
                  <input
                    type="number"
                    value={manualModal.extra_amount}
                    onChange={(e) => setManualModal({ ...manualModal, extra_amount: e.target.value })}
                    placeholder="e.g. 20"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Extra Notes</label>
                  <input
                    type="text"
                    value={manualModal.extra_notes}
                    onChange={(e) => setManualModal({ ...manualModal, extra_notes: e.target.value })}
                    placeholder="e.g. 2 Extra Rotis"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setManualModal({ ...manualModal, open: false })}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm"
                >
                  Save Manual Delivery
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Extra Item Modal */}
      {extraModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Add Extra Items for {extraModal.customer?.name} ({extraModal.meal_slot})
            </h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Extra Amount (₹):</label>
              <input
                type="number"
                value={extraModal.amount}
                onChange={(e) => setExtraModal({ ...extraModal, amount: e.target.value })}
                placeholder="e.g. 20"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description / Notes:</label>
              <input
                type="text"
                value={extraModal.notes}
                onChange={(e) => setExtraModal({ ...extraModal, notes: e.target.value })}
                placeholder="e.g. 2 Extra Rotis, Sweet"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setExtraModal({ open: false, customer: null, meal_slot: 'Lunch', amount: 0, notes: '' })}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExtra}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                Save Extra
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
