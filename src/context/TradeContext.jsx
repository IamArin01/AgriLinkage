import { createContext, useContext, useState, useCallback } from "react";
import { INITIAL_LOTS, INITIAL_CHATS } from "../data/mockData";

const TradeContext = createContext(null);

export function TradeProvider({ children }) {
  const [role, setRole] = useState("farmer");
  const [lots, setLots] = useState(INITIAL_LOTS);
  const [chats, setChats] = useState(INITIAL_CHATS);

  const addLot = useCallback((newLot) => {
    setLots((prev) => [newLot, ...prev]);
  }, []);

  const sendOffer = useCallback((convoId, amount) => {
    setChats((prev) => {
      const currentRoleChats = prev[role] || [];
      const updated = currentRoleChats.map((c) => {
        if (c.id !== convoId) return c;
        const messages = [...c.messages, { from: "me", type: "offer", amount }];
        const close = c.theirOffer && Math.abs(c.theirOffer - amount) <= 100;
        return {
          ...c,
          myOffer: amount,
          messages,
          status: close ? "ready_to_confirm" : "negotiating",
        };
      });
      return { ...prev, [role]: updated };
    });
  }, [role]);

  const value = {
    role,
    setRole,
    lots,
    addLot,
    chats: chats[role] || [],
    sendOffer,
  };

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}

export const useTrade = () => useContext(TradeContext);
