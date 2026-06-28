export type OmConsumerServiceType =
  | 'new_connection'
  | 'disconnection'
  | 'reconnection'
  | 'meter_replacement'
  | 'ownership_transfer';

export type OmConsumerConnectionStatus = 'pending' | 'active' | 'inactive' | 'disconnected' | 'temporary_suspension';

export const OM_CONSUMER_SERVICE_TYPES: Array<{ type: OmConsumerServiceType; label: string }> = [
  { type: 'new_connection', label: 'New Connection' },
  { type: 'disconnection', label: 'Disconnection' },
  { type: 'reconnection', label: 'Reconnection' },
  { type: 'meter_replacement', label: 'Meter Replacement' },
  { type: 'ownership_transfer', label: 'Ownership Transfer' },
];

export const OM_CONSUMER_CONNECTION_STATUSES: Array<{ status: OmConsumerConnectionStatus; label: string }> = [
  { status: 'pending', label: 'Pending Connection' },
  { status: 'active', label: 'Active' },
  { status: 'inactive', label: 'Inactive' },
  { status: 'disconnected', label: 'Disconnected' },
  { status: 'temporary_suspension', label: 'Temporary Suspension' },
];

export function getConsumerServiceLabel(type: string): string {
  return OM_CONSUMER_SERVICE_TYPES.find((t) => t.type === type)?.label ?? type.replace(/_/g, ' ');
}

export function getConnectionStatusLabel(status: string): string {
  return OM_CONSUMER_CONNECTION_STATUSES.find((s) => s.status === status)?.label ?? status;
}
