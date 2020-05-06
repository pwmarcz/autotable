
export type Player = {};

export type Thing = {};

interface JoinMessage {
  type: 'JOIN';
  gameId: string | null;
  secret: string | null;
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

export type Message = JoinMessage | JoinedMessage | PlayerMessage | UpdateMessage | ReplaceMessage;
