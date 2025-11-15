import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './Button';
import toast from 'react-hot-toast';

interface JsonViewerProps {
  data: any;
  title?: string;
  collapsed?: number;
}

export const JsonViewer = ({ data, title, collapsed = 2 }: JsonViewerProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-8"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      )}
      <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code className="text-gray-800 dark:text-gray-200">
          {JSON.stringify(data, null, 2)}
        </code>
      </pre>
    </div>
  );
};

