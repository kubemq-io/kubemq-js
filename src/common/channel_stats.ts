export interface QueuesStats {
  /** The number of messages in the queue */
  messages: number;

  /** The total volume of the messages in the queue */
  volume: number;

  /** The number of messages waiting in the queue */
  waiting: number;

  /** The number of messages that have expired */
  expired: number;

  /** The number of delayed messages */
  delayed: number;
}

export interface QueuesChannel {
  /** The name of the channel */
  name: string;

  /** The type of the channel */
  type: string;

  /** The timestamp of the last activity on the channel */
  lastActivity: number;

  /** Indicates whether the channel is currently active or not */
  isActive: boolean;

  /** The statistics of incoming messages on the channel */
  incoming: QueuesStats;

  /** The statistics of outgoing messages on the channel */
  outgoing: QueuesStats;
}

export interface PubSubStats {
  /** The number of messages */
  messages: number;

  /** The volume of the messages */
  volume: number;
}

export interface PubSubChannel {
  /** The name of the channel */
  name: string;

  /** The type of the channel */
  type: string;

  /** The timestamp of the last activity on the channel */
  lastActivity: number;

  /** Indicates whether the channel is currently active */
  isActive: boolean;

  /** The statistics related to incoming messages on the channel */
  incoming: PubSubStats;

  /** The statistics related to outgoing messages on the channel */
  outgoing: PubSubStats;
}

export interface CQStats {
  /** The number of messages in the queue */
  messages: number;

  /** The volume of the queue */
  volume: number;

  /** The number of responses in the queue */
  responses: number;
}

export interface CQChannel {
  /** A string representing the name of the channel */
  name: string;

  /** A string representing the type of the channel */
  type: string;

  /** An integer representing the timestamp of the last activity on the channel */
  lastActivity: number;

  /** A boolean indicating whether the channel is active or not */
  isActive: boolean;

  /** An instance of the CQStats interface representing the incoming statistics of the channel */
  incoming: CQStats;

  /** An instance of the CQStats interface representing the outgoing statistics of the channel */
  outgoing: CQStats;
}
