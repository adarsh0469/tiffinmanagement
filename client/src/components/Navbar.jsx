import React from 'react';
import { UtensilsCrossed, LayoutDashboard, CalendarCheck, Users, Receipt, FileText, Settings as SettingsIcon } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, centerName }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dispatch', label: 'Daily Dispatch', icon: CalendarCheck },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'billing', label: 'Bills & Payments', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center text-slate-900 shadow-md">
              <UtensilsCrossed className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-amber-400">
                {centerName || 'Adarsh Tiffin Centre'}
              </h1>
              <p className="text-xs text-slate-400">Billing & Dispatch Manager</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex space-x-1 md:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </div>
    </header>
  );
}
