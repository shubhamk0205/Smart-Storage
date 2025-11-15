import { useState, useEffect } from 'react';
import { RefreshCw, RotateCcw, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { JsonViewer } from '../components/JsonViewer';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { getJobs, getJob, retryJob } from '../services/api';
import type { Job } from '../types';
import toast from 'react-hot-toast';

export const Logs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data);
    } catch (error: any) {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (job: Job) => {
    try {
      const fullJob = await getJob(job.id);
      setSelectedJob(fullJob);
      setShowDetails(true);
    } catch (error: any) {
      toast.error('Failed to load job details');
    }
  };

  const handleRetry = async (job: Job) => {
    try {
      await retryJob(job.id);
      toast.success('Job retry initiated');
      await loadJobs();
    } catch (error: any) {
      toast.error('Failed to retry job');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      ingest: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      detection: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      loading: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Logs & Jobs</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor operations and job status
          </p>
        </div>
        <Button variant="secondary" onClick={loadJobs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs"
            description="Operations will appear here"
          />
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {getStatusIcon(job.status)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(job.type)}`}>
                          {job.type}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {job.stagingId && `Staging: ${job.stagingId}`}
                        {job.datasetName && ` • Dataset: ${job.datasetName}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Created: {formatDate(job.createdAt)}
                        {job.completedAt && ` • Completed: ${formatDate(job.completedAt)}`}
                      </p>
                      {job.error && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-300">{job.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(job)}>
                      View
                    </Button>
                    {job.status === 'error' && (
                      <Button variant="ghost" size="sm" onClick={() => handleRetry(job)}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Job Details"
        size="lg"
      >
        {selectedJob && <JsonViewer data={selectedJob} />}
      </Modal>
    </div>
  );
};

