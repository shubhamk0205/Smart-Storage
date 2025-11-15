import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Copy, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { JsonViewer } from '../components/JsonViewer';
import { processMedia, getMediaAsset } from '../services/api';
import type { MediaAsset } from '../types';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';

export const MediaProcessing = () => {
  const { stagingId } = useParams<{ stagingId: string }>();
  const [destinationKey, setDestinationKey] = useState('');
  const [processing, setProcessing] = useState(false);
  const [mediaAsset, setMediaAsset] = useState<MediaAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMediaAsset = async (assetId: string) => {
    try {
      setLoading(true);
      const asset = await getMediaAsset(assetId);
      setMediaAsset(asset);
    } catch (error: any) {
      toast.error('Failed to load media asset');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!stagingId) return;
    try {
      setProcessing(true);
      const result = await processMedia(stagingId, destinationKey || undefined);
      setMediaAsset(result);
      toast.success('Media processed successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const copyUrl = () => {
    if (mediaAsset?.publicUrl) {
      navigator.clipboard.writeText(mediaAsset.publicUrl);
      toast.success('URL copied to clipboard');
    }
  };

  const isImage = mediaAsset?.mimeType?.startsWith('image/');
  const isVideo = mediaAsset?.mimeType?.startsWith('video/');
  const isAudio = mediaAsset?.mimeType?.startsWith('audio/');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Media Processing Wizard</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Process staging file as media asset
        </p>
      </div>

      {!mediaAsset ? (
        <Card>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Destination Key (Optional)
              </label>
              <input
                type="text"
                value={destinationKey}
                onChange={(e) => setDestinationKey(e.target.value)}
                placeholder="Leave empty for auto-generated key"
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
              Process Media
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Media processed successfully</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Public URL
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={mediaAsset.publicUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                  <Button variant="secondary" onClick={copyUrl}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>

              {isImage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={mediaAsset.publicUrl}
                      alt={mediaAsset.originalFilename}
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                </div>
              )}

              {isVideo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <video
                      src={mediaAsset.publicUrl}
                      controls
                      className="w-full h-auto max-h-96"
                    />
                  </div>
                </div>
              )}

              {isAudio && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <audio src={mediaAsset.publicUrl} controls className="w-full" />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Metadata">
            {loading ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                    Size
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {(mediaAsset.sizeBytes / 1024).toFixed(2)} KB
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                    SHA256
                  </label>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white truncate">
                    {mediaAsset.sha256}
                  </p>
                </div>
                {mediaAsset.width && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Width
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{mediaAsset.width}px</p>
                  </div>
                )}
                {mediaAsset.height && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Height
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{mediaAsset.height}px</p>
                  </div>
                )}
                {mediaAsset.duration && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                      Duration
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {Math.floor(mediaAsset.duration)}s
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                    MIME Type
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{mediaAsset.mimeType}</p>
                </div>
              </div>
            )}
          </Card>

          {mediaAsset.rawExif && (
            <Card title="EXIF Data">
              <JsonViewer data={mediaAsset.rawExif} />
            </Card>
          )}

          <Card title="Media Asset Record">
            <JsonViewer data={mediaAsset} />
          </Card>
        </>
      )}
    </div>
  );
};

