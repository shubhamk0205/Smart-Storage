import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Database, FileJson, Code, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { JsonViewer } from '../components/JsonViewer';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/Table';
import { processJson, getJsonProfile } from '../services/api';
import type { Dataset, JsonProfile } from '../types';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';

export const JsonProcessing = () => {
  const { stagingId } = useParams<{ stagingId: string }>();
  const navigate = useNavigate();
  const [datasetName, setDatasetName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [profile, setProfile] = useState<JsonProfile | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'sql' | 'json' | 'summary'>('profile');
  const [backendOverride, setBackendOverride] = useState<'sql' | 'nosql' | ''>('');
  const [loadingProgress, setLoadingProgress] = useState({ inserted: 0, errors: 0 });

  useEffect(() => {
    if (stagingId) {
      loadProfile();
    }
  }, [stagingId]);

  const loadProfile = async () => {
    if (!stagingId) return;
    try {
      const data = await getJsonProfile(stagingId);
      setProfile(data);
    } catch (error: any) {
      toast.error('Failed to load JSON profile');
    }
  };

  const handleProcess = async () => {
    if (!stagingId) return;
    try {
      setProcessing(true);
      const result = await processJson(stagingId, datasetName || undefined);
      setDataset(result.dataset);
      setProfile(result.profile);
      setActiveTab('summary');
      toast.success('JSON processed successfully');
      
      // Simulate loading progress
      const interval = setInterval(() => {
        setLoadingProgress(prev => ({
          inserted: prev.inserted + Math.floor(Math.random() * 10),
          errors: prev.errors,
        }));
      }, 500);
      
      setTimeout(() => {
        clearInterval(interval);
        setLoadingProgress({ inserted: 100, errors: 0 });
      }, 5000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const generateSqlDdl = () => {
    if (!profile || !dataset) return '';
    const tableName = dataset.default_entity;
    const columns = profile.fields.map(field => {
      let sqlType = 'TEXT';
      if (field.type === 'number') sqlType = 'NUMERIC';
      if (field.type === 'boolean') sqlType = 'BOOLEAN';
      if (field.type === 'date') sqlType = 'TIMESTAMP';
      const nullable = field.nullable ? '' : 'NOT NULL';
      return `  ${field.name} ${sqlType} ${nullable}`;
    }).join(',\n');
    return `CREATE TABLE ${tableName} (\n  id SERIAL PRIMARY KEY,\n${columns}\n);`;
  };

  const generateJsonSchema = () => {
    if (!profile || !dataset) return {};
    const properties: Record<string, any> = {};
    profile.fields.forEach(field => {
      let type = field.type;
      if (field.array) type = { type: 'array', items: { type: field.type } };
      if (field.nested) type = { type: 'object' };
      properties[field.name] = {
        type,
        ...(field.nullable ? {} : { required: true }),
        ...(field.enum ? { enum: field.enum } : {}),
      };
    });
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required: profile.fields.filter(f => !f.nullable).map(f => f.name),
    };
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FileJson },
    { id: 'sql', label: 'SQL DDL', icon: Database },
    { id: 'json', label: 'JSON Schema', icon: Code },
    { id: 'summary', label: 'Summary', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">JSON Processing Wizard</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Process JSON file and create dataset
        </p>
      </div>

      {!dataset ? (
        <Card>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dataset Name (Optional)
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="Leave empty for auto-generated name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={processing}
              />
            </div>
            <Button
              onClick={handleProcess}
              disabled={processing}
              loading={processing}
              className="w-full"
            >
              Process JSON
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="mt-6">
              {activeTab === 'profile' && profile && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Field Profile</h3>
                    <Table>
                      <TableHead>
                        <TableHeader>Field</TableHeader>
                        <TableHeader>Type</TableHeader>
                        <TableHeader>Required</TableHeader>
                        <TableHeader>Nullable</TableHeader>
                        <TableHeader>Flags</TableHeader>
                      </TableHead>
                      <TableBody>
                        {profile.fields.map((field, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{field.name}</TableCell>
                            <TableCell>{field.type}</TableCell>
                            <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
                            <TableCell>{field.nullable ? 'Yes' : 'No'}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                {field.array && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                    Array
                                  </span>
                                )}
                                {field.nested && (
                                  <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                                    Nested
                                  </span>
                                )}
                                {field.enum && (
                                  <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                    Enum
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Sample Records</h3>
                    <JsonViewer data={profile.sampleRecords.slice(0, 3)} />
                  </div>
                </div>
              )}

              {activeTab === 'sql' && (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Backend Decision
                    </label>
                    <select
                      value={backendOverride || dataset.backend}
                      onChange={(e) => setBackendOverride(e.target.value as 'sql' | 'nosql')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="sql">SQL (PostgreSQL)</option>
                      <option value="nosql">NoSQL (MongoDB)</option>
                    </select>
                  </div>
                  <JsonViewer data={generateSqlDdl()} />
                </div>
              )}

              {activeTab === 'json' && (
                <JsonViewer data={generateJsonSchema()} />
              )}

              {activeTab === 'summary' && dataset && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Dataset created successfully</span>
                  </div>
                  
                  {processing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Loading progress</span>
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Inserted: {loadingProgress.inserted} records
                        {loadingProgress.errors > 0 && (
                          <span className="text-red-600 dark:text-red-400 ml-4">
                            Errors: {loadingProgress.errors}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Dataset Catalog Entry</h3>
                    <JsonViewer data={dataset} />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

