import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Sun, Moon, IndianRupee, AlertCircle, Calendar, ArrowRight, UserPlus, CheckCircle } from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tiffin Operations Overview</h2>
          <p className="text-sm text-slate-500 mt-1">
            Today's Date: <span className="font-semibold text-slate-700">{stats?.today}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('dispatch')}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm shadow-sm transition-all"
          >
            <Calendar className="w-4 h-4" />
            <span>Mark Today's Dispatch</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Active Customers Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Customers</p>
            <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{stats?.activeCustomers}</h3>
            {stats?.pausedCustomers > 0 && (
              <p className="text-xs text-amber-600 font-medium mt-1">
                + {stats?.pausedCustomers} customer(s) currently on leave
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Lunch Target */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Lunch Target</p>
            <h3 className="text-3xl font-extrabold text-amber-600 mt-1">
              {stats?.todayLunchDelivered} <span className="text-lg font-normal text-slate-500">/ {stats?.todayLunchToPrepare}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">Tiffins Delivered / Total Target</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Sun className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Dinner Target */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Dinner Target</p>
            <h3 className="text-3xl font-extrabold text-indigo-600 mt-1">
              {stats?.todayDinnerDelivered} <span className="text-lg font-normal text-slate-500">/ {stats?.todayDinnerToPrepare}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">Tiffins Delivered / Total Target</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Moon className="w-6 h-6" />
          </div>
        </div>

        {/* Monthly Collection & Dues */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Month Collection</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">₹{stats?.monthCollected}</h3>
            {stats?.monthPending > 0 ? (
              <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" /> ₹{stats?.monthPending} Pending Dues
              </p>
            ) : (
              <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" /> All Dues Cleared
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Quick Action Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h4 className="text-lg font-bold text-amber-400">Ready to record today's tiffin deliveries?</h4>
          <p className="text-sm text-slate-300">
            Quickly update Lunch & Dinner status for all active customers in seconds.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('dispatch')}
          className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap shadow-sm"
        >
          <span>Open Daily Dispatch Tracker</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
