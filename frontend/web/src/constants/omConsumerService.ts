/** Stage 9 — Consumer service (mirrors backend) */

export type OmConsumerServiceType =
  | 'new_connection'
  | 'disconnection'
  | 'reconnection'
  | 'meter_replacement'
  | 'ownership_transfer';

export const OM_CONSUMER_SERVICE_TYPES: Array<{ type: OmConsumerServiceType; label: string }> = [
  { type: 'new_connection', label: 'New Connection' },
  { type: 'disconnection', label: 'Disconnection' },
  { type: 'reconnection', label: 'Reconnection' },
  { type: 'meter_replacement', label: 'Meter Replacement' },
  { type: 'ownership_transfer', label: 'Ownership Transfer' },
];

export function connectionStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'disconnected') return 'error';
  return 'default';
}

export function requestStatusColor(status: string): 'success' | 'warning' | 'default' {
  if (status === 'completed') return 'success';
  if (status === 'requested') return 'warning';
  return 'default';
}
