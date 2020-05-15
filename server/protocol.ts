interface NewMessage {
  type: 'NEW';
}

interface JoinMessage {
  type: 'JOIN';
  gameId: string;
}

interface JoinedMessage {
  type: 'JOINED';
  gameId: string;
  playerId: string;
  isFirst: boolean;
}

interface UpdateMessage {
  type: 'UPDATE';
  // kind, key, value
  entries: Array<Entry>;
  full: boolean;
}

export type Entry = [string, string | number, any | null];

export type Message = NewMessage
  | JoinMessage
  | JoinedMessage
  | UpdateMessage;
