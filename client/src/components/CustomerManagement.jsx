import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Search, Edit3, Trash2, Pause, Play, Phone, MapPin, Wallet, Calendar, Palmtree, Plus, AlertCircle } from 'lucide-react';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Multi-filters
  const [statusFilter, setStatusFilter] = useState('Active');
  const [dietFilter, setDietFilter] = useState('All');
  const [preferenceFilter, setPreferenceFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add/Edit Customer Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    meal_preference: 'Both',
    diet_type: 'Veg',
    plan_type: 'PerMeal',
    rate_lunch: 80,
    rate_dinner: 80,
    monthly_rate: 3000,
    advance_balance: 0,
    status: 'Active',
    start_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Leave Manager Modal State
  const [leaveModal, setLeaveModal] = useState({
    open: false,
    customer: null,
    leaves: [],
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = `/api/customers?status=${statusFilter}&diet_type=${dietFilter}&meal_preference=${preferenceFilter}&plan_type=${planFilter}&search=${searchTerm}`;
      const res = await axios.get(url);
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter, dietFilter, preferenceFilter, planFilter, searchTerm]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      meal_preference: 'Both',
      diet_type: 'Veg',
      plan_type: 'PerMeal',
      rate_lunch: 80,
      rate_dinner: 80,
      monthly_rate: 3000,
      advance_balance: 0,
      status: 'Active',
      start_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({ 
      ...customer,
      start_date: customer.start_date || new Date().toISOString().split('T')[0]
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await axios.put(`/api/customers/${editingCustomer.id}`, formData);
      } else {
        await axios.post('/api/customers', formData);
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to save customer');
    }
  };

  const handleToggleStatus = async (customer) => {
    const nextStatus = customer.status === 'Active' ? 'Paused' : 'Active';
    try {
      await axios.patch(`/api/customers/${customer.id}/status`, { status: nextStatus });
      fetchCustomers();
    } catch (err) {
      console.error('Failed status change:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer? All logs and bill history for this customer will be removed.')) return;
    try {
      await axios.delete(`/api/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      console.error('Failed to delete customer:', err);
    }
  };

  // Leave Management Functions
  const handleOpenLeaveModal = async (customer) => {
    try {
      const res = await axios.get(`/api/leaves?customer_id=${customer.id}`);
      setLeaveModal({
        open: true,
        customer,
        leaves: res.data.leaves || [],
        from_date: new Date().toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        reason: 'Out of station'
      });
    } catch (err) {
      console.error('Failed to load leaves:', err);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!leaveModal.customer) return;
    try {
      await axios.post('/api/leaves', {
        customer_id: leaveModal.customer.id,
        from_date: leaveModal.from_date,
        to_date: leaveModal.to_date,
        reason: leaveModal.reason
      });
      // Refresh leave list inside modal & customer list
      const res = await axios.get(`/api/leaves?customer_id=${leaveModal.customer.id}`);
      setLeaveModal(prev => ({ ...prev, leaves: res.data.leaves || [], reason: '' }));
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record leave period');
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    try {
      await axios.delete(`/api/leaves/${leaveId}`);
      const res = await axios.get(`/api/leaves?customer_id=${leaveModal.customer.id}`);
      setLeaveModal(prev => ({ ...prev, leaves: res.data.leaves || [] }));
      fetchCustomers();
    } catch (err) {
      console.error('Failed to delete leave:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Customer Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer plans, contact details, start dates, advance balances, and leave schedules</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-sm self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Multi-Filter Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
            {['Active', 'Paused', 'Inactive', 'All'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            />
          </div>

        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Diet Type:</label>
            <select
              value={dietFilter}
              onChange={(e) => setDietFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="All">All Diets (Veg, Non-Veg, Jain)</option>
              <option value="Veg">Veg 🟢</option>
              <option value="Non-Veg">Non-Veg 🔴</option>
              <option value="Jain">Jain 🟡</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Meal Preference:</label>
            <select
              value={preferenceFilter}
              onChange={(e) => setPreferenceFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="All">All Preferences (Both, Lunch, Dinner)</option>
              <option value="Both">Both (Lunch & Dinner)</option>
              <option value="Lunch">Lunch Only</option>
              <option value="Dinner">Dinner Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pricing Plan:</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="All">All Pricing Plans</option>
              <option value="PerMeal">Per Meal Daily Rate</option>
              <option value="Monthly">Fixed Monthly Package</option>
            </select>
          </div>
        </div>

      </div>

      {/* Customer Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
          No customers found matching filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {customers.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              
              {/* Header Info */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{c.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 mt-1 space-x-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    c.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : c.status === 'Paused'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {c.status}
                  </span>
                </div>

                {c.address && (
                  <div className="flex items-start space-x-1 text-xs text-slate-600 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{c.address}</span>
                  </div>
                )}

                {/* Tiffin Joining Start Date */}
                <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Joined Date: <strong className="text-slate-700">{c.start_date || 'N/A'}</strong></span>
                </div>

                {/* Plan Details & Advance Pills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                    Meal: {c.meal_preference}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    c.diet_type === 'Non-Veg' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {c.diet_type}
                  </span>
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-xs font-medium">
                    {c.plan_type === 'Monthly' ? `Monthly Pkg (₹${c.monthly_rate})` : `Daily (L:₹${c.rate_lunch} / D:₹${c.rate_dinner})`}
                  </span>
                </div>

                {/* Advance Balance Badge */}
                {c.advance_balance > 0 && (
                  <div className="mt-2.5 flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded-lg text-xs font-bold">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span>Advance Balance Available: ₹{c.advance_balance}</span>
                  </div>
                )}

                {c.notes && (
                  <p className="text-xs text-slate-500 italic mt-2.5 bg-slate-50 p-2 rounded border border-slate-100">
                    "{c.notes}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleStatus(c)}
                  className={`flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded transition-all ${
                    c.status === 'Active'
                      ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {c.status === 'Active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{c.status === 'Active' ? 'Pause' : 'Resume'}</span>
                </button>

                <button
                  onClick={() => handleOpenLeaveModal(c)}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded transition-all"
                  title="Manage Leave Dates"
                >
                  <Palmtree className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Leaves</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
                    title="Edit Customer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 my-8">
            <h3 className="text-xl font-bold text-slate-800">
              {editingCustomer ? 'Edit Customer Details' : 'Add New Tiffin Customer'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Flat 302, Royal Apartments, Station Road"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tiffin Start / Join Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Meal Preference</label>
                  <select
                    value={formData.meal_preference}
                    onChange={(e) => setFormData({ ...formData, meal_preference: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Both">Both (Lunch & Dinner)</option>
                    <option value="Lunch">Lunch Only</option>
                    <option value="Dinner">Dinner Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Diet Type</label>
                  <select
                    value={formData.diet_type}
                    onChange={(e) => setFormData({ ...formData, diet_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Veg">Veg 🟢</option>
                    <option value="Non-Veg">Non-Veg 🔴</option>
                    <option value="Jain">Jain 🟡</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pricing Model</label>
                  <select
                    value={formData.plan_type}
                    onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="PerMeal">Per Meal Rate</option>
                    <option value="Monthly">Fixed Monthly Pkg</option>
                  </select>
                </div>
              </div>

              {/* Rate configuration inputs based on plan type */}
              {formData.plan_type === 'PerMeal' ? (
                <div className="grid grid-cols-2 gap-4 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Lunch Rate (₹)</label>
                    <input
                      type="number"
                      value={formData.rate_lunch}
                      onChange={(e) => setFormData({ ...formData, rate_lunch: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Dinner Rate (₹)</label>
                    <input
                      type="number"
                      value={formData.rate_dinner}
                      onChange={(e) => setFormData({ ...formData, rate_dinner: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 space-y-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fixed Monthly Rate (₹)</label>
                  <input
                    type="number"
                    value={formData.monthly_rate}
                    onChange={(e) => {
                      const mRate = parseFloat(e.target.value) || 0;
                      const slots = formData.meal_preference === 'Both' ? 2 : 1;
                      const calculatedRate = Math.round(mRate / (30 * slots)) || 60;
                      setFormData({ ...formData, monthly_rate: mRate, rate_lunch: calculatedRate, rate_dinner: calculatedRate });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {formData.monthly_rate > 0 && (
                    <p className="text-[11px] text-amber-800 font-semibold pt-1">
                      💡 Per-Tiffin Rate Equivalent: ₹{Math.round(formData.monthly_rate / (30 * (formData.meal_preference === 'Both' ? 2 : 1)))} / meal
                    </p>
                  )}
                </div>
              )}

              {/* Advance Balance Input */}
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200">
                <label className="block text-xs font-semibold text-emerald-800 mb-1">Initial / Current Advance Balance (₹)</label>
                <input
                  type="number"
                  value={formData.advance_balance}
                  onChange={(e) => setFormData({ ...formData, advance_balance: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 500"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Preferences</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Less oil, extra salad"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm"
                >
                  Save Customer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Leave Schedule Manager Modal */}
      {leaveModal.open && leaveModal.customer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                Leave Schedule for {leaveModal.customer.name}
              </h3>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                Auto-skips Daily Logs
              </span>
            </div>

            {/* Add Leave Form */}
            <form onSubmit={handleAddLeave} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-700">Add New Leave Range:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">From Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveModal.from_date}
                    onChange={(e) => setLeaveModal({ ...leaveModal, from_date: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">To Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveModal.to_date}
                    onChange={(e) => setLeaveModal({ ...leaveModal, to_date: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Reason / Note:</label>
                <input
                  type="text"
                  value={leaveModal.reason}
                  onChange={(e) => setLeaveModal({ ...leaveModal, reason: e.target.value })}
                  placeholder="e.g. Out of town for exams"
                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded text-xs transition-all shadow-sm flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Leave Period</span>
              </button>
            </form>

            {/* Existing Leaves List */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">Existing Scheduled Leaves:</p>
              {leaveModal.leaves.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded text-center">No leave periods recorded.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {leaveModal.leaves.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 p-2 rounded text-xs">
                      <div>
                        <span className="font-bold text-indigo-950">{l.from_date} to {l.to_date}</span>
                        {l.reason && <span className="text-slate-500 ml-2">({l.reason})</span>}
                      </div>
                      <button
                        onClick={() => handleDeleteLeave(l.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Delete Leave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setLeaveModal({ ...leaveModal, open: false, customer: null })}
                className="px-4 py-1.5 rounded text-xs bg-slate-200 text-slate-800 font-bold hover:bg-slate-300"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
