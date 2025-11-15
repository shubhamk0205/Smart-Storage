import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Copy, Download, Table as TableIcon, FileJson } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { JsonViewer } from '../components/JsonViewer';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/Table';
import { getDatasets, retrieve } from '../services/api';
import type { Dataset } from '../types';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';

export const Retrieval = () => {
  const [searchParams] = useSearchParams();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState(searchParams.get('dataset') || '');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [filterJson, setFilterJson] = useState('{}');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [includeTree, setIncludeTree] = useState('{}');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDatasets();
    const datasetParam = searchParams.get('dataset');
    if (datasetParam) {
      setSelectedDataset(datasetParam);
    }
  }, []);

  const loadDatasets = async () => {
    try {
      const data = await getDatasets();
      setDatasets(data);
    } catch (error: any) {
      toast.error('Failed to load datasets');
    }
  };

  const handleExecute = async () => {
    if (!selectedDataset || !selectedEntity) {
      toast.error('Please select dataset and entity');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let filter = {};
      try {
        filter = JSON.parse(filterJson);
      } catch (e) {
        throw new Error('Invalid filter JSON');
      }

      let include = {};
      try {
        include = JSON.parse(includeTree);
      } catch (e) {
        // Include is optional
      }

      const params = {
        dataset: selectedDataset,
        entity: selectedEntity,
        filter,
        fields: selectedFields.length > 0 ? selectedFields : undefined,
        include: Object.keys(include).length > 0 ? include : undefined,
        limit,
        offset,
      };

      const data = await retrieve(params);
      setResults(data);
      toast.success(`Retrieved ${data.length} records`);
    } catch (error: any) {
      const message = error.message || 'Retrieval failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyCurl = () => {
    const curlCommand = `curl -X POST ${window.location.origin}/api/retrieve \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    dataset: selectedDataset,
    entity: selectedEntity,
    filter: JSON.parse(filterJson),
    fields: selectedFields,
    include: JSON.parse(includeTree),
    limit,
    offset,
  }, null, 2)}'`;
    navigator.clipboard.writeText(curlCommand);
    toast.success('cURL command copied to clipboard');
  };

  const copyRequestBody = () => {
    const body = JSON.stringify({
      dataset: selectedDataset,
      entity: selectedEntity,
      filter: JSON.parse(filterJson),
      fields: selectedFields,
      include: JSON.parse(includeTree),
      limit,
      offset,
    }, null, 2);
    navigator.clipboard.writeText(body);
    toast.success('Request body copied to clipboard');
  };

  const selectedDatasetData = datasets.find(d => d.name === selectedDataset);
  const availableFields = selectedDatasetData ? ['id', ...(selectedDatasetData.entities || [])] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Retrieval Playground</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Query your datasets with flexible filters
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Query Builder">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dataset
              </label>
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select dataset</option>
                {datasets.map((ds) => (
                  <option key={ds.name} value={ds.name}>
                    {ds.name} ({ds.backend})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Entity/Table/Collection
              </label>
              <input
                type="text"
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                placeholder="Enter entity name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter JSON
              </label>
              <textarea
                value={filterJson}
                onChange={(e) => setFilterJson(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='{"field": "value"}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fields (comma-separated)
              </label>
              <input
                type="text"
                value={selectedFields.join(', ')}
                onChange={(e) => setSelectedFields(e.target.value.split(',').map(f => f.trim()).filter(f => f))}
                placeholder="field1, field2, field3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Include Tree (JSON)
              </label>
              <textarea
                value={includeTree}
                onChange={(e) => setIncludeTree(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='{"relation": true}'
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Limit
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Offset
                </label>
                <input
                  type="number"
                  value={offset}
                  onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <Button
              onClick={handleExecute}
              disabled={loading || !selectedDataset || !selectedEntity}
              loading={loading}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Execute Query
            </Button>
          </div>
        </Card>

        <Card title="Results">
          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <Button
                  variant={viewMode === 'json' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('json')}
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  JSON
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="w-4 h-4 mr-2" />
                  Table
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm" onClick={copyCurl}>
                  <Copy className="w-4 h-4 mr-2" />
                  cURL
                </Button>
                <Button variant="ghost" size="sm" onClick={copyRequestBody}>
                  <Copy className="w-4 h-4 mr-2" />
                  Body
                </Button>
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-64" />
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No results. Execute a query to see results.
              </div>
            ) : viewMode === 'json' ? (
              <JsonViewer data={results} />
            ) : (
              <div className="overflow-x-auto">
                {results.length > 0 && (
                  <Table>
                    <TableHead>
                      {Object.keys(results[0]).map((key) => (
                        <TableHeader key={key}>{key}</TableHeader>
                      ))}
                    </TableHead>
                    <TableBody>
                      {results.map((result, idx) => (
                        <TableRow key={idx}>
                          {Object.values(result).map((value: any, i) => (
                            <TableCell key={i}>
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {results.length > 0 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {offset + 1}-{offset + results.length}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={results.length < limit}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

