export const THEME_COLORS = {
  bg: "#F5F6F0",
  ink: "#1B2420",
  sub: "#6B7268",
  card: "#FFFFFF",
  line: "#E4E1D3",
  primary: "#1E4732",
  primarySoft: "#E4ECE4",
  gold: "#D98A2B",
  goldSoft: "#FBEAD2",
  clay: "#B65C38",
  claySoft: "#F5E3DA",
  teal: "#2A6773",
  tealSoft: "#DFEBEC",
  up: "#2C7A4B",
  down: "#B23B3B",
};

export const CROPS = [
  { id: "arhar", name: "Arhar", price: 6820, change: 45 },
  { id: "masoor", name: "Masoor", price: 5460, change: 120 },
  { id: "chana", name: "Chana", price: 5180, change: -30 },
  { id: "urad", name: "Urad", price: 7340, change: 60 },
  { id: "moong", name: "Moong", price: 7860, change: -15 },
  { id: "kabuli", name: "Kabuli Chana", price: 6650, change: 90 },
];

export const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;