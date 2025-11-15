import { useState, useEffect } from 'react';
import { 
  Search, 
  Eye, 
  Trash2, 
  FileSearch, 
  Image as ImageIcon, 
  FileJson,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/Table';
import { Modal } from '../components/Modal';
import { JsonViewer } from '../components/JsonViewer';
import { EmptyState } from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import {
  getStagingFiles,
  detectAndClassify,
  deleteStagingFile,
} from '../services/api';
import type { StagingFile, DetectionResult } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const Staging = () => {
  const [files, setFiles] = useState<StagingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<StagingFile | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showDetection, setShowDetection] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await getStagingFiles();
      setFiles(data);
    } catch (error: any) {
      toast.error('Failed to load staging files');
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async (file: StagingFile) => {
    try {
      setProcessing(file.id);
      const result = await detectAndClassify(file.id);
      setDetectionResult(result);
      setSelectedFile(file);
      setShowDetection(true);
      toast.success('Detection completed');
      await loadFiles();
    } catch (error: any) {
      toast.error('Detection failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleProcessMedia = async (file: StagingFile) => {
    navigate(`/media-processing/${file.id}`);
  };

  const handleProcessJson = async (file: StagingFile) => {
    navigate(`/json-processing/${file.id}`);
  };

  const handleDelete = async (file: StagingFile) => {
    if (!confirm(`Delete ${file.originalFilename}?`)) return;
    try {
      await deleteStagingFile(file.id);
      toast.success('File deleted');
      await loadFiles();
    } catch (error: any) {
      toast.error('Delete failed');
    }
  };

  const handleViewDetails = (file: StagingFile) => {
    setSelectedFile(file);
    setShowDetails(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      detected: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const filteredFiles = files.filter(file =>
    file.originalFilename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.sha256.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Staging Queue</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage files awaiting processing
          </p>
        </div>
        <Button variant="secondary" onClick={loadFiles} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by filename or SHA256..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            title="No staging files"
            description={searchTerm ? 'No files match your search' : 'Upload files to see them here'}
          />
        ) : (
          <Table>
            <TableHead>
              <TableHeader>Filename</TableHeader>
              <TableHeader>Size</TableHeader>
              <TableHeader>SHA256</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableHead>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="font-medium">{file.originalFilename}</div>
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {file.sha256.substring(0, 16)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(file.status)}`}>
                      {file.status}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(file.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDetect(file)}
                        disabled={processing === file.id}
                        title="Detect & Classify"
                      >
                        <FileSearch className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcessMedia(file)}
                        disabled={processing === file.id}
                        title="Process as Media"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcessJson(file)}
                        disabled={processing === file.id}
                        title="Process as JSON"
                      >
                        <FileJson className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(file)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(file)}
                        disabled={processing === file.id}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
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
        title="File Details"
        size="lg"
      >
        {selectedFile && <JsonViewer data={selectedFile} />}
      </Modal>

      <Modal
        isOpen={showDetection}
        onClose={() => setShowDetection(false)}
        title="MIME Detection & Classification"
        size="md"
      >
        {detectionResult && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                MIME Type
              </label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <code className="text-sm">{detectionResult.mimeType}</code>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Kind
              </label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <code className="text-sm">{detectionResult.fileKind}</code>
              </div>
            </div>
            <JsonViewer data={detectionResult} title="Full Result" />
          </div>
        )}
      </Modal>
    </div>
  );
};

