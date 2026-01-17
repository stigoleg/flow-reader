/**
 * Sync Status Badge
 * 
 * Displays the current sync status with a colored indicator.
 */

import type { SyncStatus } from '@/lib/sync/types';

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const getStatusInfo = () => {
    switch (status.state) {
      case 'disabled':
        return { label: 'Not configured', color: 'opacity-50' };
      case 'idle':
        return { label: 'Connected', color: 'text-green-500' };
      case 'syncing':
        return { label: 'Syncing...', color: 'text-blue-500' };
      case 'error':
        return { label: 'Error', color: 'text-red-500' };
      default:
        return { label: 'Unknown', color: 'opacity-50' };
    }
  };

  const { label, color } = getStatusInfo();

  return (
    <div className={`inline-flex items-center gap-1.5 text-sm ${color}`}>
      <span className={`w-2 h-2 rounded-full ${
        status.state === 'syncing' ? 'bg-blue-500 animate-pulse' : 
        status.state === 'idle' ? 'bg-green-500' :
        status.state === 'error' ? 'bg-red-500' : 'bg-current/30'
      }`} />
      {label}
    </div>
  );
}
