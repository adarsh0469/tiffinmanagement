import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Building, Phone, QrCode, MapPin, IndianRupee, CheckCircle, Database, Download, Upload, AlertCircle } from 'lucide-react';

export default function Settings({ onSettingsUpdated }) {
  const [settings, setSettings] = useState({
    center_name: 'Adarsh Tiffin Centre',
    owner_phone: '9876543210',
    upi_id: '9876543210@upi',
    address: 'Main Market, City',
    default_lunch_rate: '80',
    default_dinner_rate: '80'
  });

  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/settings');
      if (res.data && Object.keys(res.data).length > 0) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/settings', settings);
      setSavedSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated(settings);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save settings');
    }
  };

  const handleExportBackup = () => {
    window.location.href = '/api/backup/export';
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('⚠️ WARNING: Restoring from a backup will replace your current database records with the backup file data. Are you sure you want to proceed?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        const res = await axios.post('/api/backup/restore', backupData);
        if (res.data.success) {
          setRestoreMessage({ type: 'success', text: 'Database restored successfully!' });
          fetchSettings();
        } else {
          setRestoreMessage({ type: 'error', text: res.data.message || 'Failed to restore database.' });
        }
      } catch (err) {
        setRestoreMessage({ type: 'error', text: 'Invalid JSON backup file or restore failed.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Business Settings Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tiffin Business Settings</h2>
          <p className="text-xs text-slate-500 mt-1">Configure business profile details and receipt header defaults</p>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-sm font-semibold flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center space-x-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Tiffin Centre / Service Name *</span>
            </label>
            <input
              type="text"
              required
              value={settings.center_name}
              onChange={(e) => setSettings({ ...settings, center_name: e.target.value })}
              placeholder="e.g. Adarsh Tiffin Centre"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Contact Phone Number *</span>
              </label>
              <input
                type="text"
                required
                value={settings.owner_phone}
                onChange={(e) => setSettings({ ...settings, owner_phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center space-x-1">
                <QrCode className="w-3.5 h-3.5 text-slate-400" />
                <span>UPI VPA / QR Handle (for Receipts)</span>
              </label>
              <input
                type="text"
                value={settings.upi_id}
                onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
                placeholder="e.g. 9876543210@upi"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Business Address / Subtitle</span>
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="e.g. Shop 12, Main Market, Civil Lines"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center space-x-1">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                <span>Default Lunch Rate (₹)</span>
              </label>
              <input
                type="number"
                value={settings.default_lunch_rate}
                onChange={(e) => setSettings({ ...settings, default_lunch_rate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center space-x-1">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                <span>Default Dinner Rate (₹)</span>
              </label>
              <input
                type="number"
                value={settings.default_dinner_rate}
                onChange={(e) => setSettings({ ...settings, default_dinner_rate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center space-x-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>

        </form>
      </div>

      {/* Database Backup & Restore Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">Database Backup & Restore</h3>
        </div>
        <p className="text-xs text-slate-500">
          Safely backup all customers, attendance logs, payment records, and settings to a JSON file, or restore from a previous backup.
        </p>

        {restoreMessage && (
          <div className={`p-3 rounded-lg text-sm font-semibold flex items-center space-x-2 ${
            restoreMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {restoreMessage.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{restoreMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Export Button */}
          <button
            onClick={handleExportBackup}
            className="flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold py-2.5 px-4 rounded-lg text-xs transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Download Database Backup (JSON)</span>
          </button>

          {/* Restore Button */}
          <label className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-lg text-xs transition-all shadow-sm cursor-pointer">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Restore Database from File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

    </div>
  );
}
