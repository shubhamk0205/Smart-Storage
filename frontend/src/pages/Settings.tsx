import { useState, useEffect } from 'react';
import { Save, CheckCircle2, XCircle, Database, Server } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { getHealth, updateApiBaseURL } from '../services/api';
import toast from 'react-hot-toast';

export const Settings = () => {
  const { settings, updateSettings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [localSettings, setLocalSettings] = useState(settings);
  const [health, setHealth] = useState<{
    status: string;
    postgres?: boolean;
    mongo?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (error: any) {
      setHealth({ status: 'error' });
    }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    updateApiBaseURL(localSettings.apiBaseUrl);
    toast.success('Settings saved');
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === undefined) return null;
    return status ? (
      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure application settings
        </p>
      </div>

      <Card title="API Configuration">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Base URL
            </label>
            <input
              type="text"
              value={localSettings.apiBaseUrl}
              onChange={(e) => setLocalSettings({ ...localSettings, apiBaseUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Media Root Path
            </label>
            <input
              type="text"
              value={localSettings.mediaRoot}
              onChange={(e) => setLocalSettings({ ...localSettings, mediaRoot: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Staging Root Path
            </label>
            <input
              type="text"
              value={localSettings.stagingRoot}
              onChange={(e) => setLocalSettings({ ...localSettings, stagingRoot: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      <Card title="Database Connections">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                PostgreSQL
              </label>
              {getStatusIcon(health?.postgres)}
            </div>
            <input
              type="text"
              value={localSettings.postgresConnection || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, postgresConnection: e.target.value })}
              placeholder="postgresql://user:pass@host:port/db"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                MongoDB
              </label>
              {getStatusIcon(health?.mongo)}
            </div>
            <input
              type="text"
              value={localSettings.mongoConnection || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, mongoConnection: e.target.value })}
              placeholder="mongodb://user:pass@host:port/db"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      <Card title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Switch between light and dark mode
            </p>
          </div>
          <Button variant="secondary" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </Button>
        </div>
      </Card>

      <Card title="System Status">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">API Status</span>
            </div>
            {health ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                health.status === 'ok'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {health.status}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                Unknown
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">PostgreSQL</span>
            </div>
            {getStatusIcon(health?.postgres)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MongoDB</span>
            </div>
            {getStatusIcon(health?.mongo)}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={loading}>
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
};

