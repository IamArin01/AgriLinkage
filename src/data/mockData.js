export const INITIAL_LOTS = [
  {
    id: "lot-1", crop: "Masoor", qty: 100, unit: "quintals", location: "Akola, MH",
    harvest: "20 Aug", quality: "Mandi Assaying Verified", assayer: "AgriCert Labs · Akola",
    price: 4500, available: "30 Aug", farmerName: "You", mine: true,
    interested: [
      { name: "Buyer 1", qty: 20, grade: "B", location: "Akola" },
      { name: "Buyer 2", qty: 40, grade: "A", location: "Amravati" },
    ],
  },
  {
    id: "lot-2", crop: "Arhar", qty: 60, unit: "quintals", location: "Akola, MH",
    harvest: "2 Sep", quality: "Self declared", assayer: "—",
    price: 6700, available: "10 Sep", farmerName: "You", mine: true, interested: [],
  },
  {
    id: "lot-3", crop: "Masoor", qty: 150, unit: "quintals", location: "Buldhana, MH",
    harvest: "18 Aug", quality: "Mandi Assaying Verified", assayer: "Krishi Labs · Buldhana",
    price: 4550, available: "28 Aug", farmerName: "Farmer 1", mine: false,
    interested: [{ name: "Buyer A", qty: 50, grade: "A", location: "Akola" }],
  },
  {
    id: "lot-4", crop: "Chana", qty: 80, unit: "quintals", location: "Akola, MH",
    harvest: "25 Aug", quality: "Self declared", assayer: "—",
    price: 5000, available: "2 Sep", farmerName: "Farmer 2", mine: false, interested: [],
  },
];

export const INITIAL_CHATS = {
  farmer: [
    {
      id: "c1", lotId: "lot-1",
      person: { name: "Buyer 1", location: "Street Address, Akola", mobile: "80132 94822", rating: 4.3 },
      lotSummary: "Masoor · 20 quintals, B grade",
      myOffer: 4500, theirOffer: 4400, status: "ready_to_confirm",
      messages: [
        { from: "them", type: "text", text: "Interested in your Masoor lot — 20 quintals, B grade." },
        { from: "them", type: "offer", amount: 4400 },
        { from: "me", type: "offer", amount: 4500 },
      ],
    },
    {
      id: "c2", lotId: "lot-1",
      person: { name: "Buyer 2", location: "Street Address, Amravati", mobile: "90211 55672", rating: 4.6 },
      lotSummary: "Masoor · 40 quintals, A grade",
      myOffer: null, theirOffer: 4300, status: "negotiating",
      messages: [{ from: "them", type: "offer", amount: 4300 }],
    },
  ],
  buyer: [
    {
      id: "c3", lotId: "lot-3",
      person: { name: "Farmer 1", location: "Street Address, Akola", mobile: "80132 94822", rating: 4.3 },
      lotSummary: "Masoor · 150 quintals available",
      myOffer: 4400, theirOffer: 4500, status: "ready_to_confirm",
      messages: [
        { from: "them", type: "text", text: "150 quintals Masoor ready, assaying verified." },
        { from: "them", type: "offer", amount: 4500 },
        { from: "me", type: "offer", amount: 4400 },
      ],
    },
  ],
};
