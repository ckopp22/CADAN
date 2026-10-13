const CONSTANTS = {
  dieFaces: ["BRICK", "LUMBER", "WOOL", "GRAIN", "ORE", "GOLD"],
  buildCosts: {
    road: { brick: 1, lumber: 1 },
    settlement: { lumber: 1, brick: 1, grain: 1, wool: 1 },
    city: { ore: 3, grain: 2 },
    knight: { grain: 1, wool: 1, ore: 1 }
  },
  goldTradeRate: 2,
  maxRollsPerTurn: 3,
  turnsPerPlayer: 15,
  xPenalty: -2,
  jackpotPoints: 25
};
