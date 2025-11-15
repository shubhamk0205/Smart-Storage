import { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Download, Copy, Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { JsonViewer } from '../components/JsonViewer';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { getMediaAssets, getMediaAsset } from '../services/api';
import type { MediaAsset } from '../types';
import toast from 'react-hot-toast';

export const Media = () => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    mime_type: '',
    original_filename: '',
    sha256: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    loadAssets();
  }, [filters]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.mime_type) params.mime_type = filters.mime_type;
      if (filters.original_filename) params.original_filename = filters.original_filename;
      if (filters.sha256) params.sha256 = filters.sha256;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      
      const data = await getMediaAssets(Object.keys(params).length > 0 ? params : undefined);
      setAssets(data);
    } catch (error: any) {
      toast.error('Failed to load media assets');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (asset: MediaAsset) => {
    try {
      const fullAsset = await getMediaAsset(asset.id);
      setSelectedAsset(fullAsset);
      setShowDetails(true);
    } catch (error: any) {
      toast.error('Failed to load asset details');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const isImage = (mimeType: string) => mimeType?.startsWith('image/');
  const isVideo = (mimeType: string) => mimeType?.startsWith('video/');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Media Browser</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse and manage your media assets
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                MIME Type
              </label>
              <input
                type="text"
                value={filters.mime_type}
                onChange={(e) => setFilters({ ...filters, mime_type: e.target.value })}
                placeholder="image/png"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filename
              </label>
              <input
                type="text"
                value={filters.original_filename}
                onChange={(e) => setFilters({ ...filters, original_filename: e.target.value })}
                placeholder="Search filename..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SHA256
              </label>
              <input
                type="text"
                value={filters.sha256}
                onChange={(e) => setFilters({ ...filters, sha256: e.target.value })}
                placeholder="Search SHA256..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          title="No media assets"
          description="Process media files to see them here"
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="p-0 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleViewDetails(asset)}>
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                {isImage(asset.mimeType) ? (
                  <img
                    src={asset.publicUrl}
                    alt={asset.originalFilename}
                    className="w-full h-full object-cover"
                  />
                ) : isVideo(asset.mimeType) ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {asset.originalFilename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {asset.mimeType}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="space-y-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  {isImage(asset.mimeType) ? (
                    <img
                      src={asset.publicUrl}
                      alt={asset.originalFilename}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {asset.originalFilename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {asset.mimeType} • {(asset.sizeBytes / 1024).toFixed(2)} KB
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(asset)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copyUrl(asset.publicUrl)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <a href={asset.publicUrl} download>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Media Asset Details"
        size="xl"
      >
        {selectedAsset && (
          <div className="space-y-6">
            <div>
              {isImage(selectedAsset.mimeType) && (
                <img
                  src={selectedAsset.publicUrl}
                  alt={selectedAsset.originalFilename}
                  className="w-full h-auto max-h-96 object-contain rounded-lg"
                />
              )}
              {isVideo(selectedAsset.mimeType) && (
                <video src={selectedAsset.publicUrl} controls className="w-full rounded-lg" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Public URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={selectedAsset.publicUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <Button variant="secondary" onClick={() => copyUrl(selectedAsset.publicUrl)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
            <JsonViewer data={selectedAsset} title="Full Metadata" />
          </div>
        )}
      </Modal>
    </div>
  );
};

