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
  password?: string;
}

interface UpdateMessage {
  type: 'UPDATE';
  // kind, key, value
  entries: Array<Entry>;
  full: boolean;
}

interface AuthMessage {
  type: 'AUTH';
  password: string;
}

interface AuthedMessage {
  type: 'AUTHED';
  isAuthed: boolean;
}


export type Entry = [string, string | number, any | null];

export type Message = NewMessage
  | JoinMessage
  | JoinedMessage
  | UpdateMessage
  | AuthMessage
  | AuthedMessage;
