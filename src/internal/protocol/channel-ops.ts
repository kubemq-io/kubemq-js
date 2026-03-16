/** @internal — Channel management types and protocol helpers */

/**
 * KubeMQ channel type identifier used for channel management operations.
 *
 * @see {@link KubeMQClient.createChannel}
 * @see {@link KubeMQClient.deleteChannel}
 * @see {@link KubeMQClient.listChannels}
 */
export type ChannelType = 'events' | 'events_store' | 'commands' | 'queries' | 'queues';

/**
 * Traffic statistics for a channel direction (incoming or outgoing).
 *
 * @see {@link ChannelInfo}
 */
export interface ChannelStats {
  /** Total number of messages processed. */
  readonly messages: number;
  /** Total data volume in bytes. */
  readonly volume: number;
}

/**
 * Metadata and statistics for a KubeMQ channel.
 *
 * @remarks
 * Returned by {@link KubeMQClient.listChannels} and its convenience aliases.
 *
 * @see {@link KubeMQClient.listChannels}
 */
export interface ChannelInfo {
  /** Channel name. */
  readonly name: string;
  /** Channel type. */
  readonly type: ChannelType;
  /** Unix timestamp (ms) of the last activity on this channel. */
  readonly lastActivity: number;
  /** Whether the channel currently has active subscribers or publishers. */
  readonly isActive: boolean;
  /** Incoming (received) traffic statistics. */
  readonly incoming: ChannelStats;
  /** Outgoing (delivered) traffic statistics. */
  readonly outgoing: ChannelStats;
}

/**
 * Map ChannelType to the string value expected by the KubeMQ server
 * in channel management requests.
 */
export function channelTypeToString(type: ChannelType): string {
  switch (type) {
    case 'events':
      return 'events';
    case 'events_store':
      return 'events_store';
    case 'commands':
      return 'commands';
    case 'queries':
      return 'queries';
    case 'queues':
      return 'queues';
  }
}
