import { useState, useEffect } from 'react';
import { Eye, Search, Filter, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/Table';
import { Modal } from '../components/Modal';
import { JsonViewer } from '../components/JsonViewer';
import { EmptyState } from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { getDatasets, getDataset } from '../services/api';
import type { Dataset } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const Datasets = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [backendFilter, setBackendFilter] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    loadDatasets();
  }, [backendFilter]);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const data = await getDatasets(backendFilter || undefined);
      setDatasets(data);
    } catch (error: any) {
      toast.error('Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (dataset: Dataset) => {
    try {
      const fullDataset = await getDataset(dataset.name);
      setSelectedDataset(fullDataset);
      setShowDetails(true);
    } catch (error: any) {
      toast.error('Failed to load dataset details');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dataset Catalog</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse and manage your datasets
          </p>
        </div>
        <Button variant="secondary" onClick={loadDatasets} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search datasets..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={backendFilter}
              onChange={(e) => setBackendFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Backends</option>
              <option value="sql">SQL</option>
              <option value="nosql">NoSQL</option>
            </select>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : datasets.length === 0 ? (
          <EmptyState
            title="No datasets"
            description="Process JSON files to create datasets"
          />
        ) : (
          <Table>
            <TableHead>
              <TableHeader>Name</TableHeader>
              <TableHeader>Backend</TableHeader>
              <TableHeader>Default Entity</TableHeader>
              <TableHeader>Schema</TableHeader>
              <TableHeader>Schema Version</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableHead>
            <TableBody>
              {datasets.map((dataset) => (
                <TableRow key={dataset.name}>
                  <TableCell className="font-medium">{dataset.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      dataset.backend === 'sql'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {dataset.backend.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>{dataset.default_entity}</TableCell>
                  <TableCell>
                    {dataset.has_schema || dataset.schema ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        ✓ Available
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        No Schema
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{dataset.schema_version}</TableCell>
                  <TableCell>{formatDate(dataset.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(dataset)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/retrieval?dataset=${dataset.name}`)}
                        title="Open Retrieval Playground"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Dataset Details"
        size="xl"
      >
        {selectedDataset && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Connection Info</h3>
              {selectedDataset.connection_info ? (
                <JsonViewer data={selectedDataset.connection_info} />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No connection info available</p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {selectedDataset.backend === 'sql' ? 'Tables' : 'Collections'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(selectedDataset.tables || selectedDataset.collections || selectedDataset.entities || []).map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            {selectedDataset.schema && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Schema Information</h3>
                <div className="space-y-4">
                  {selectedDataset.schema.jsonSchema && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">JSON Schema</h4>
                      <JsonViewer data={selectedDataset.schema.jsonSchema} />
                    </div>
                  )}
                  {selectedDataset.schema.sqlDDL && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">SQL DDL</h4>
                      <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm overflow-x-auto">
                        <code className="text-gray-800 dark:text-gray-200">{selectedDataset.schema.sqlDDL}</code>
                      </pre>
                    </div>
                  )}
                  {selectedDataset.schema.fields && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Fields</h4>
                      <JsonViewer data={selectedDataset.schema.fields} />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold mb-2">Full Dataset Record</h3>
              <JsonViewer data={selectedDataset} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

