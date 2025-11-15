import { useState, useRef } from 'react';
import { Upload as UploadIcon, File, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { JsonViewer } from '../components/JsonViewer';
import { uploadFile } from '../services/api';
import type { StagingFile } from '../types';
import toast from 'react-hot-toast';

export const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stagingRecord, setStagingRecord] = useState<StagingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStagingRecord(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await uploadFile(file, datasetName || undefined, true); // Auto-process by default
      clearInterval(progressInterval);
      setProgress(100);
      setStagingRecord(result);
      
      // Check if file was processed
      if (result.processed) {
        if (result.dataset) {
          toast.success(`File uploaded and processed! Dataset: ${result.dataset.name}`);
        } else if (result.mediaAsset) {
          toast.success('File uploaded and processed! Media asset created.');
        } else {
          toast.success('File uploaded and processed successfully!');
        }
      } else if (result.error) {
        toast.error(`Upload succeeded but processing failed: ${result.error}`);
      } else {
        toast.success('File uploaded successfully (processing skipped)');
      }
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload any type of file to EZ_store
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select File
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="space-y-1 text-center">
                <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                    <span>Upload a file</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Any file type supported
                </p>
              </div>
            </div>
            {file && (
              <div className="mt-4 flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <File className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dataset Name (Optional)
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="Enter dataset name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Uploading...
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            loading={uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </Button>
        </div>
      </Card>

      {stagingRecord && (
        <Card title="Upload Result">
          <div className="space-y-4">
            {stagingRecord.processed ? (
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">File uploaded and processed successfully!</span>
              </div>
            ) : stagingRecord.error ? (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">File uploaded but processing failed: {stagingRecord.error}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">File uploaded successfully</span>
              </div>
            )}
            
            {stagingRecord.dataset && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Dataset Created</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Name:</strong> {stagingRecord.dataset.name}<br />
                  <strong>Backend:</strong> {stagingRecord.dataset.backend}<br />
                  <strong>Storage:</strong> {stagingRecord.dataset.backend === 'sql' ? 'PostgreSQL' : 'MongoDB'}
                </p>
              </div>
            )}
            
            {stagingRecord.mediaAsset && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Media Asset Created</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>URL:</strong> <a href={stagingRecord.mediaAsset.publicUrl} target="_blank" rel="noopener noreferrer" className="underline">{stagingRecord.mediaAsset.publicUrl}</a><br />
                  {stagingRecord.mediaAsset.width && stagingRecord.mediaAsset.height && (
                    <>
                      <strong>Dimensions:</strong> {stagingRecord.mediaAsset.width} × {stagingRecord.mediaAsset.height}<br />
                    </>
                  )}
                </p>
              </div>
            )}
            
            <JsonViewer data={stagingRecord} />
          </div>
        </Card>
      )}
    </div>
  );
};

