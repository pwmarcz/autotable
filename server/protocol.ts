interface NewMessage {
  type: 'NEW';
  num: number | null;
  numPlayers: number;
}

interface JoinMessage {
  type: 'JOIN';
  gameId: string;
  num: number | null;
}

interface RejoinMessage {
  type: 'REJOIN';
  gameId: string;
  num: number;
  secret: string;
}

interface JoinedMessage {
  type: 'JOINED';
  gameId: string;
  secret: string;
  num: number;
  isFirst: boolean;
}

interface UpdateMessage {
  type: 'UPDATE';
  // kind, key, value
  entries: Array<Entry>;
  full: boolean;
}

export type Entry = [string, string | number, any];

export type Message = NewMessage
  | JoinMessage
  | RejoinMessage
  | JoinedMessage
  | UpdateMessage;
