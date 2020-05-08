
export type Player = {};

export type Thing = {};

interface NewMessage {
  type: 'NEW';
  num: number | null;
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
}

interface PlayerMessage {
  type: 'PLAYER';
  num: number;
  player: Player | null;
}

interface UpdateMessage {
  type: 'UPDATE';
  things: Record<number, Thing>;
}

interface ReplaceMessage {
  type: 'REPLACE';
  allThings: Array<any>;
}

export type Message = NewMessage | JoinMessage | RejoinMessage | JoinedMessage | PlayerMessage | UpdateMessage | ReplaceMessage;
