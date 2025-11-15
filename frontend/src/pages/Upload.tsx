import { useState, useRef } from 'react';
import { Upload as UploadIcon, File, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { JsonViewer } from '../components/JsonViewer';
import { uploadFile } from '../services/api';
import type { StagingFile } from '../types';
import toast from 'react-hot-toast';

interface FileUploadItem {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  result?: StagingFile;
  error?: string;
}

export const Upload = () => {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stagingRecord, setStagingRecord] = useState<StagingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const newFiles: FileUploadItem[] = selectedFiles.map(file => ({
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: 'pending' as const,
        progress: 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
      setStagingRecord(null);
    }
    // Reset input to allow selecting same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setUploading(true);

    // Upload files sequentially to avoid overwhelming the server
    for (const fileItem of pendingFiles) {
      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading', progress: 0 } : f
        ));

        // Simulate progress
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map(f => {
            if (f.id === fileItem.id && f.status === 'uploading') {
              const newProgress = Math.min(f.progress + 10, 90);
              return { ...f, progress: newProgress };
            }
            return f;
          }));
        }, 200);

        const result = await uploadFile(fileItem.file, datasetName || undefined, true);
        
        clearInterval(progressInterval);
        
        // Update with success
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, status: 'success', progress: 100, result } 
            : f
        ));

        // Show toast for each file
        if (result.processed) {
          if (result.dataset) {
            toast.success(`${fileItem.file.name}: Dataset created - ${result.dataset.name}`);
          } else if (result.mediaAsset) {
            toast.success(`${fileItem.file.name}: Media asset created`);
          } else {
            toast.success(`${fileItem.file.name}: Uploaded and processed`);
          }
        } else if (result.error) {
          toast.error(`${fileItem.file.name}: ${result.error}`);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id 
              ? { ...f, status: 'error', error: result.error } 
              : f
          ));
        } else {
          toast.success(`${fileItem.file.name}: Uploaded successfully`);
        }

        // Set the last uploaded file as the staging record for display
        setStagingRecord(result);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Upload failed';
        toast.error(`${fileItem.file.name}: ${errorMessage}`);
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, status: 'error', error: errorMessage } 
            : f
        ));
      }
    }

    setUploading(false);
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
                    <span>Upload file(s)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Any file type supported • Select multiple files
                </p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Selected Files ({files.length})
                  </p>
                  <button
                    onClick={() => setFiles([])}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    disabled={uploading}
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border ${
                        fileItem.status === 'success'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : fileItem.status === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : fileItem.status === 'uploading'
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {fileItem.status === 'uploading' ? (
                          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                        ) : fileItem.status === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : fileItem.status === 'error' ? (
                          <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <File className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {fileItem.file.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(fileItem.file.size)}
                          </p>
                          {fileItem.status === 'uploading' && (
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {fileItem.progress}%
                            </span>
                          )}
                          {fileItem.status === 'success' && (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              ✓ Success
                            </span>
                          )}
                          {fileItem.status === 'error' && (
                            <span className="text-xs text-red-600 dark:text-red-400">
                              ✗ Failed
                            </span>
                          )}
                        </div>
                        {fileItem.status === 'uploading' && (
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${fileItem.progress}%` }}
                            />
                          </div>
                        )}
                        {fileItem.status === 'error' && fileItem.error && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fileItem.error}
                          </p>
                        )}
                      </div>
                      {fileItem.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(fileItem.id)}
                          className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          disabled={uploading}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
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

          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            loading={uploading}
            className="w-full"
          >
            {uploading 
              ? `Uploading ${files.filter(f => f.status === 'uploading').length} file(s)...` 
              : files.length > 0 
                ? `Upload ${files.length} File${files.length > 1 ? 's' : ''}`
                : 'Upload File(s)'}
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

