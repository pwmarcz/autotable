import { DealType, GameType } from "./types";

type DealRange = [string, 0 | 1 | 2 | 3, number];

export interface DealPart {
  roll?: number;
  tiles?: Array<number>;
  rotationIndex?: number;
  ranges: Array<DealRange>;
  absolute?: boolean;
}

export const DEALS: Record<GameType, Record<DealType, Array<DealPart>>> = {
  FOUR_PLAYER: {
    INITIAL: [
      {
        ranges: [
          ['wall.1.0', 0, 34],
          ['wall.1.0', 1, 34],
          ['wall.1.0', 2, 34],
          ['wall.1.0', 3, 34],
        ]
      },
    ],
    WINDS: [
      {
        tiles: [27, 28, 29, 30],
        ranges: [['hand.5', 0, 4]],
        rotationIndex: 2,
      },
      {
        ranges: [
          ['wall.1.0', 0, 32],
          ['wall.1.0', 1, 34],
          ['wall.1.0', 2, 32],
          ['wall.1.0', 3, 34],
        ],
      },
    ],
    HANDS: [
      {
        ranges: [
          ['hand.0', 0, 13],
          ['hand.0', 1, 13],
          ['hand.0', 2, 13],
          ['hand.0', 3, 13],
        ],
        rotationIndex: 2,
      },

      { roll: 2, ranges: [['wall.16.0', 1, 4], ['wall.0.0', 2, 10], ['wall.6.0', 2, 24], ['wall.1.0', 3, 34], ['wall.1.0', 0, 12]] },
      { roll: 3, ranges: [['wall.15.0', 2, 6], ['wall.0.0', 3, 8], ['wall.5.0', 3, 26], ['wall.1.0', 0, 34], ['wall.1.0', 1, 10]] },
      { roll: 4, ranges: [['wall.14.0', 3, 8], ['wall.0.0', 0, 6], ['wall.4.0', 0, 28], ['wall.1.0', 1, 34], ['wall.1.0', 2, 8]] },
      { roll: 5, ranges: [['wall.13.0', 0, 10], ['wall.0.0', 1, 4], ['wall.3.0', 1, 30], ['wall.1.0', 2, 34], ['wall.1.0', 3, 6]] },
      { roll: 6, ranges: [['wall.12.0', 1, 12], ['wall.0.0', 2, 2], ['wall.2.0', 2, 32], ['wall.1.0', 3, 34], ['wall.1.0', 0, 4]] },

      { roll: 7, ranges: [['wall.11.0', 2, 14], ['wall.1.0', 3, 34], ['wall.1.0', 0, 34], ['wall.1.0', 1, 2]] },

      { roll: 8, ranges: [['wall.9.0', 3, 14], ['wall.17.0', 3, 2], ['wall.1.0', 0, 34], ['wall.1.0', 1, 34]] },
      { roll: 9, ranges: [['wall.8.0', 0, 14], ['wall.16.0', 0, 4], ['wall.1.0', 1, 34], ['wall.1.0', 2, 32]] },
      { roll: 10, ranges: [['wall.7.0', 1, 14], ['wall.15.0', 1, 6], ['wall.1.0', 2, 34], ['wall.1.0', 3, 30]] },
      { roll: 11, ranges: [['wall.6.0', 2, 14], ['wall.14.0', 2, 8], ['wall.1.0', 3, 34], ['wall.1.0', 0, 28]] },
      { roll: 12, ranges: [['wall.5.0', 3, 14], ['wall.13.0', 3, 10], ['wall.1.0', 0, 34], ['wall.1.0', 1, 26]] },
    ],
  },

  BAMBOO: {
    INITIAL: [{ ranges: [['wall.1.0', 0, 36]], absolute: true}],
    WINDS: [
      {
        tiles: [18, 26],
        ranges: [['hand.6', 0, 2]],
        rotationIndex: 2,
      },
      {
        ranges: [['wall.1.0', 0, 34]],
      },
    ],
    HANDS: [
      {
        ranges: [
          ['hand.0', 0, 13],
          ['hand.0', 2, 13],
        ],
        rotationIndex: 2,
      },
      {
        ranges: [['wall.1.0', 0, 10]],
      },
    ],
  }
};
