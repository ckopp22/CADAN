// Transcribed from reference/island-one-board.jpg. Hexes run clockwise from top-left.
// Knight number (1-6) is printed above each hex's resource; knight 6 sits on the "?" hex.
const ISLAND_ONE = {
  islandId: "island-one",
  hexes: [
    { id: "hex-ore", resource: "ORE", knight: 1, position: "top-left" },
    { id: "hex-desert", resource: "ANY", knight: 6, position: "top" },
    { id: "hex-brick", resource: "BRICK", knight: 5, position: "top-right" },
    { id: "hex-lumber", resource: "LUMBER", knight: 4, position: "bottom-right" },
    { id: "hex-wool", resource: "WOOL", knight: 3, position: "bottom" },
    { id: "hex-grain", resource: "GRAIN", knight: 2, position: "bottom-left" }
  ],
  buildSlots: [
    // Roads: every slot is worth 1. road-1 is the pre-built starting road (arrow between ore and desert).
    // "vertices" are the two map corners a road joins. A road can be built only if it shares a vertex
    // with an already built road. Roads have no ascending order.
    { id: "road-1", type: "road", pointValue: 1, vertices: ["v1", "v2"], free: true },
    { id: "road-2", type: "road", pointValue: 1, vertices: ["v3", "v4"] },
    { id: "road-3", type: "road", pointValue: 1, vertices: ["v3", "v5"] },
    { id: "road-4", type: "road", pointValue: 1, vertices: ["v7", "v8"] },
    { id: "road-5", type: "road", pointValue: 1, vertices: ["v17", "v2"] },
    { id: "road-6", type: "road", pointValue: 1, vertices: ["v16", "v17"] },
    { id: "road-7", type: "road", pointValue: 1, vertices: ["v5", "v12"] },
    { id: "road-8", type: "road", pointValue: 1, vertices: ["v8", "v9"] },
    { id: "road-9", type: "road", pointValue: 1, vertices: ["v15", "v16"] },
    { id: "road-10", type: "road", pointValue: 1, vertices: ["v12", "v11"] },
    { id: "road-11", type: "road", pointValue: 1, vertices: ["v9", "v10"] },
    { id: "road-12", type: "road", pointValue: 1, vertices: ["v14", "v15"] },
    { id: "road-13", type: "road", pointValue: 1, vertices: ["v11", "v13"] },
    { id: "road-14", type: "road", pointValue: 1, vertices: ["v17", "v18"] },
    { id: "road-15", type: "road", pointValue: 1, vertices: ["v20", "v15"] },
    { id: "road-16", type: "road", pointValue: 1, vertices: ["v10", "v11"] },
    { id: "road-17", type: "road", pointValue: 1, vertices: ["v13", "v14"] },
    // Settlements and cities: "vertex" is the map corner; building needs a built road touching that vertex.
    { id: "settlement-1", type: "settlement", pointValue: 3, order: 1, vertex: "v2" },
    { id: "settlement-2", type: "settlement", pointValue: 4, order: 2, vertex: "v16" },
    { id: "settlement-3", type: "settlement", pointValue: 5, order: 3, vertex: "v14" },
    { id: "settlement-4", type: "settlement", pointValue: 7, order: 4, vertex: "v11" },
    { id: "settlement-5", type: "settlement", pointValue: 9, order: 5, vertex: "v5" },
    { id: "settlement-6", type: "settlement", pointValue: 11, order: 6, vertex: "v4" },
    // Cities
    { id: "city-1", type: "city", pointValue: 7, order: 1, vertex: "v18" },
    { id: "city-2", type: "city", pointValue: 12, order: 2, vertex: "v20" },
    { id: "city-3", type: "city", pointValue: 20, order: 3, vertex: "v9" },
    { id: "city-4", type: "city", pointValue: 30, order: 4, vertex: "v7" },
    // Knights: points equal the printed number; joker is the hex's resource.
    { id: "knight-1", type: "knight", pointValue: 1, order: 1, jokerResource: "ORE" },
    { id: "knight-2", type: "knight", pointValue: 2, order: 2, jokerResource: "GRAIN" },
    { id: "knight-3", type: "knight", pointValue: 3, order: 3, jokerResource: "WOOL" },
    { id: "knight-4", type: "knight", pointValue: 4, order: 4, jokerResource: "LUMBER" },
    { id: "knight-5", type: "knight", pointValue: 5, order: 5, jokerResource: "BRICK" },
    { id: "knight-6", type: "knight", pointValue: 6, order: 6, jokerResource: "ANY" }
  ],
  winCondition: { mode: "turnLimit", turns: 15 }
};
