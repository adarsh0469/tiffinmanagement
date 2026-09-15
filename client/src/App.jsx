import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import DailyTracker from './components/DailyTracker';
import CustomerManagement from './components/CustomerManagement';
import BillingPayments from './components/BillingPayments';
import Reports from './components/Reports';
import Settings from './components/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [centerName, setCenterName] = useState('Adarsh Tiffin Centre');

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data?.center_name) {
        setCenterName(res.data.center_name);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} centerName={centerName} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'dispatch' && <DailyTracker />}
        {activeTab === 'customers' && <CustomerManagement />}
        {activeTab === 'billing' && <BillingPayments />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'settings' && <Settings onSettingsUpdated={(s) => setCenterName(s.center_name)} />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 no-print text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} {centerName} • Billing & Daily Dispatch Management System</p>
      </footer>
    </div>
  );
}
