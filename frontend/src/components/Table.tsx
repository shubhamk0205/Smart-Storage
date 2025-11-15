import { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export const Table = ({ children, className = '' }: TableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHead = ({ children }: { children: ReactNode }) => {
  return (
    <thead className="bg-gray-50 dark:bg-gray-800">
      <tr>{children}</tr>
    </thead>
  );
};

export const TableHeader = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
};

export const TableBody = ({ children }: { children: ReactNode }) => {
  return <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>;
};

export const TableRow = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  return <tr className={className}>{children}</tr>;
};

export const TableCell = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </td>
  );
};

