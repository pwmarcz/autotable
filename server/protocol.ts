
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

interface PlayerMessage<P> {
  type: 'PLAYER';
  num: number;
  player: P | null;
}

interface UpdateMessage<T> {
  type: 'UPDATE';
  things: Record<number, T>;
}

interface ReplaceMessage<T> {
  type: 'REPLACE';
  allThings: Array<T>;
}

export type Message<P, T> = NewMessage
  | JoinMessage
  | RejoinMessage
  | JoinedMessage
  | PlayerMessage<P>
  | UpdateMessage<T>
  | ReplaceMessage<T>;
