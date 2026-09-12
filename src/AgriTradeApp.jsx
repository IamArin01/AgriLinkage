import React, { useState, useMemo, useRef, useEffect } from "react";
import WelcomeAuth from "./WelcomeAuth";
import { supabase } from "./lib/supabaseClient";
import {
  Home, Sprout, ShoppingBasket, MessageCircle, CircleUser, Search,
  ChevronLeft, Plus, TrendingUp, TrendingDown, MapPin, Phone, Star,
  ShieldCheck, X, Check, Wallet, ArrowRight, ChevronRight, Clock,
  Wifi, BatteryFull, SignalHigh, Delete, Landmark, Users,
  FileWarning, Boxes, Receipt, IdCard
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";
import { CROPS, THEME_COLORS, formatCurrency } from "./constants/theme.js";
import { TradeProvider, useTrade } from "./context/TradeContext.jsx";
import HomeScreen from "./components/HomeScreen.jsx";

/* ----------------------------- color palette bridge ----------------------------- */

const C = {
  ink: "#1B2420",
  sub: "#6B7268",
  teal: "#1D4E57",
  clay: "#8A3F22",
  gold: "#8A5A16",
  up: "#2C7A4B",
  down: "#B23B3B",
};

const fmtRs = formatCurrency;

/* ----------------------------- design tokens ----------------------------- */

const TREND = {
  arhar: [6710, 6740, 6690, 6760, 6790, 6775, 6820],
  masoor: [5210, 5260, 5300, 5340, 5380, 5420, 5460],
  chana: [5260, 5240, 5220, 5205, 5190, 5185, 5180],
  urad: [7180, 7210, 7250, 7270, 7300, 7320, 7340],
  moong: [7920, 7900, 7880, 7875, 7865, 7862, 7860],
  kabuli: [6480, 6510, 6540, 6560, 6590, 6620, 6650],
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

const MANDI_TABLE = [
  { mandi: "Akola APMC", price: 5450, distance: "12 km", warehouse: "WDRA warehouse · 4 km" },
  { mandi: "Amravati Krishi Mandi", price: 5510, distance: "34 km", warehouse: "WDRA warehouse · 9 km" },
  { mandi: "Washim Mandi Samiti", price: 5380, distance: "48 km", warehouse: "No WDRA warehouse nearby" },
];

const INITIAL_LOTS = [
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

const INITIAL_CHATS = {
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

const TOOL_ITEMS = [
  {
    key: "expense-calculator",
    name: "Expense Calculator",
    subtitle: "Estimate net profit after transport and labour costs",
    badge: "Profit",
    icon: Search,
  },
  {
    key: "mandi-travel",
    name: "Mandi Travel Expense",
    subtitle: "Compare mandi options and estimated travel cost",
    badge: "Travel",
    icon: MapPin,
  },
  {
    key: "govt-schemes",
    name: "Govt Schemes",
    subtitle: "Browse crop and farmer support schemes",
    badge: "Schemes",
    icon: Receipt,
  },
  {
    key: "wdra-warehouse",
    name: "WDRA Warehouse",
    subtitle: "View warehouse locations and storage rate references",
    badge: "Storage",
    icon: Boxes,
  },
  {
    key: "supply-demand",
    name: "Supply & Demand",
    subtitle: "Check recent commodity arrival trends",
    badge: "Trend",
    icon: TrendingUp,
  },
  {
    key: "map-overview",
    name: "Map Overview",
    subtitle: "See farm, mandi and buyer locations on one map view",
    badge: "Map",
    icon: MapPin,
  },
];

/* ------------------------------- primitives ------------------------------- */
function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-2 px-4 h-14 shrink-0 bg-[#F5F6F0] border-b border-[#E4E1D3]">
      {onBack ? (
        <button onClick={onBack} className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full active:bg-[#E4E1D3]">
          <ChevronLeft size={22} color={C.ink} />
        </button>
      ) : <div className="w-2" />}
      <h1 className="text-[19px] font-semibold text-[#1B2420] flex-1 truncate">{title}</h1>
      {right}
    </div>
  );
}

function Pill({ children, tone = "primary", className = "" }) {
  const tones = {
    primary: "bg-[#E4ECE4] text-[#1E4732]",
    gold: "bg-[#FBEAD2] text-[#8A5A16]",
    clay: "bg-[#F5E3DA] text-[#8A3F22]",
    teal: "bg-[#DFEBEC] text-[#1D4E57]",
    up: "bg-[#E2F1E7] text-[#2C7A4B]",
    down: "bg-[#F6E4E4] text-[#B23B3B]",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

function RoleBadge({ role }) {
  return role === "farmer"
    ? <Pill tone="clay"><Sprout size={12} />Farmer</Pill>
    : <Pill tone="teal"><ShoppingBasket size={12} />Buyer</Pill>;
}

/* --------------------------------- Trade ----------------------------------- */
function LotCard({ lot, role, onOpen }) {
  return (
    <button onClick={onOpen} className="w-full text-left bg-white border border-[#E4E1D3] rounded-2xl p-3.5 flex flex-col gap-2 active:scale-[0.99] transition-transform">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[16px] font-semibold text-[#1B2420]">{lot.crop}</p>
          <p className="text-[12px] text-[#6B7268]">{lot.qty} {lot.unit} · {lot.location}</p>
        </div>
        <span className="text-[15px] font-semibold text-[#1E4732]">{fmtRs(lot.price)}<span className="text-[10px] text-[#6B7268]">/q</span></span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Pill tone={lot.quality.includes("Verified") ? "up" : "gold"}>
          <ShieldCheck size={11} />{lot.quality}
        </Pill>
        <Pill tone="primary"><Clock size={11} />Available {lot.available}</Pill>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-[#EEECDF] mt-0.5">
        <span className="text-[12px] text-[#6B7268]">
          {role === "farmer" ? (lot.mine ? "Your lot" : lot.farmerName) : lot.farmerName}
        </span>
        <span className="text-[12px] font-semibold text-[#1B2420] flex items-center gap-1">
          <Users size={13} />{lot.interested.length} interested <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

function TradeListScreen({ role, lots, onOpenLot, onCreateLot }) {
  const [cropFilter, setCropFilter] = useState("all");
  const visible = role === "farmer" ? lots.filter((l) => l.mine) : lots;
  const filtered = cropFilter === "all" ? visible : visible.filter((l) => l.crop.toLowerCase() === cropFilter);

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4 flex items-center justify-between">
        <div>
          <p className="font-[#Fraunces] text-[18px] font-semibold text-[#1B2420]">
            {role === "farmer" ? "Published lots" : "Lots from farmers"}
          </p>
          <p className="text-[12px] text-[#6B7268]">{filtered.length} {filtered.length === 1 ? "lot" : "lots"}</p>
        </div>
        {role === "farmer" && (
          <button onClick={onCreateLot} className="w-10 h-10 rounded-full bg-[#B65C38] flex items-center justify-center shadow-sm">
            <Plus size={20} color="white" />
          </button>
        )}
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        {["all", ...CROPS.map((c) => c.name.toLowerCase())].map((c) => (
          <button key={c} onClick={() => setCropFilter(c)}
            className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-semibold border capitalize ${cropFilter === c ? "bg-[#1E4732] border-[#1E4732] text-white" : "bg-white border-[#E4E1D3] text-[#1B2420]"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="px-4 flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <div className="text-center py-14">
            <Boxes className="mx-auto mb-2" size={28} color={C.sub} />
            <p className="text-[13px] text-[#6B7268]">No lots here yet.</p>
          </div>
        )}
        {filtered.map((lot) => <LotCard key={lot.id} lot={lot} role={role} onOpen={() => onOpenLot(lot)} />)}
      </div>
    </div>
  );
}

function CreateLotScreen({ onPublish, onBack }) {
  const [form, setForm] = useState({
    crop: "Masoor", qty: "", location: "Akola, MH", harvest: "", quality: "Mandi Assaying Verified",
    assayer: "", price: "", available: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canPublish = form.qty && form.price && form.harvest && form.available;

  const Field = ({ label, children }) => (
    <div className="mb-3">
      <label className="text-[12px] font-semibold text-[#1B2420] mb-1 block">{label}</label>
      {children}
    </div>
  );
  const inputCls = "w-full h-11 rounded-xl border border-[#E4E1D3] bg-white px-3 text-[14px] text-[#1B2420] outline-none focus:border-[#1E4732]";

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
      <Field label="Crop">
        <select className={inputCls} value={form.crop} onChange={set("crop")}>
          {CROPS.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Quantity (quintals)">
        <input className={inputCls} type="number" placeholder="e.g. 100" value={form.qty} onChange={set("qty")} />
      </Field>
      <Field label="Location">
        <input className={inputCls} value={form.location} onChange={set("location")} />
      </Field>
      <Field label="Harvest date">
        <input className={inputCls} placeholder="e.g. 20 Aug" value={form.harvest} onChange={set("harvest")} />
      </Field>
      <Field label="Quality">
        <select className={inputCls} value={form.quality} onChange={set("quality")}>
          <option>Mandi Assaying Verified</option>
          <option>Self declared</option>
        </select>
      </Field>
      {form.quality === "Mandi Assaying Verified" && (
        <Field label="Assaying name & contact">
          <input className={inputCls} placeholder="e.g. AgriCert Labs · Akola" value={form.assayer} onChange={set("assayer")} />
        </Field>
      )}
      <Field label="Expected price (₹ / quintal)">
        <input className={inputCls} type="number" placeholder="e.g. 4500" value={form.price} onChange={set("price")} />
      </Field>
      <Field label="Available from">
        <input className={inputCls} placeholder="e.g. 30 Aug" value={form.available} onChange={set("available")} />
      </Field>

      <button
        disabled={!canPublish}
        onClick={() => onPublish({
          id: "lot-" + Date.now(), crop: form.crop, qty: form.qty, unit: "quintals",
          location: form.location, harvest: form.harvest, quality: form.quality,
          assayer: form.assayer || "—", price: Number(form.price), available: form.available,
          farmerName: "You", mine: true, interested: [],
        })}
        className={`w-full h-12 rounded-xl font-semibold text-[15px] text-white mt-2 ${canPublish ? "bg-[#1E4732]" : "bg-[#B7BDAF]"}`}
      >
        Publish lot
      </button>
    </div>
  );
}

function LotDetailScreen({ lot, role, onOpenPerson }) {
  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4 bg-white border border-[#E4E1D3] rounded-2xl p-4">
        <div className="flex items-start justify-between">
          <p className="text-[20px] font-semibold text-[#1B2420]">{lot.crop}</p>
          <span className="text-[18px] font-semibold text-[#1E4732]">{fmtRs(lot.price)}<span className="text-[11px] text-[#6B7268]">/q</span></span>
        </div>
        <p className="text-[12px] text-[#6B7268] mb-3">{lot.farmerName === "You" ? "Your lot" : lot.farmerName}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            ["Quantity", `${lot.qty} ${lot.unit}`],
            ["Location", lot.location],
            ["Harvest", lot.harvest],
            ["Available", lot.available],
            ["Quality", lot.quality],
            ["Assaying", lot.assayer],
          ].map(([k, v]) => (
            <div key={k} className="bg-[#F5F6F0] rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[#8B9086]">{k}</p>
              <p className="text-[13px] font-medium text-[#1B2420] truncate">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3">
        <p className="text-[13px] font-semibold text-[#1B2420] mb-2 px-0.5">
          {role === "farmer" ? `Interested buyers (${lot.interested.length})` : `Other buyers on this lot (${lot.interested.length})`}
        </p>
        <div className="flex flex-col gap-2">
          {lot.interested.length === 0 && (
            <div className="bg-white border border-dashed border-[#E4E1D3] rounded-2xl p-5 text-center">
              <p className="text-[12px] text-[#6B7268]">No offers yet — check back soon.</p>
            </div>
          )}
          {lot.interested.map((p, i) => (
            <button key={i} onClick={() => onOpenPerson(p)} className="w-full text-left bg-white border border-[#E4E1D3] rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
              <div className="w-10 h-10 rounded-full bg-[#DFEBEC] flex items-center justify-center shrink-0">
                <CircleUser size={22} color={C.teal} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1B2420]">{p.name}</p>
                <p className="text-[11px] text-[#6B7268]">{p.qty} quintals · Grade {p.grade}{p.location ? ` · ${p.location}` : ""}</p>
              </div>
              <ChevronRight size={16} color={C.sub} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonDetailScreen({ person, lotSummary, onContact }) {
  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4 bg-white border border-[#E4E1D3] rounded-2xl p-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[#DFEBEC] flex items-center justify-center">
          <CircleUser size={30} color={C.teal} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold text-[#1B2420]">{person.name}</p>
          <p className="text-[12px] text-[#6B7268] flex items-center gap-1"><MapPin size={12} />{person.location || "Akola, MH"}</p>
          <div className="flex items-center gap-1 mt-1">
            <Star size={13} color={C.gold} fill={C.gold} />
            <span className="text-[12px] font-semibold text-[#1B2420]">{person.rating || 4.3}</span>
            <span className="text-[11px] text-[#6B7268]">rating on AgriTrade</span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 bg-white border border-[#E4E1D3] rounded-2xl p-3.5">
        <p className="text-[12px] font-semibold text-[#1B2420] mb-1">This offer</p>
        <p className="text-[13px] text-[#6B7268]">{lotSummary || `${person.qty} quintals · Grade ${person.grade}`}</p>
      </div>

      <div className="px-4 mt-3 bg-white border border-[#E4E1D3] rounded-2xl p-3.5">
        <p className="text-[12px] font-semibold text-[#1B2420] mb-2">Past transactions on AgriTrade</p>
        {[["14 Jun", "Masoor · 80 q", "₹4,320/q"], ["2 Apr", "Chana · 40 q", "₹4,980/q"]].map((t, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-t border-[#EEECDF] first:border-t-0 first:pt-0">
            <span className="text-[12px] text-[#6B7268]">{t[0]} · {t[1]}</span>
            <span className="text-[12px] font-semibold text-[#1B2420]">{t[2]}</span>
          </div>
        ))}
      </div>

      <button onClick={onContact} className="mt-4 w-full h-12 rounded-xl bg-[#1E4732] text-white font-semibold text-[15px] flex items-center justify-center gap-2">
        <Phone size={16} /> Contact {person.name}
      </button>
    </div>
  );
}

/* ---------------------------------- Chat ----------------------------------- */
function ChatListScreen({ role, chats, onOpen }) {
  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4 pb-2">
        <p className="text-[18px] font-semibold text-[#1B2420]">Chats</p>
        <p className="text-[12px] text-[#6B7268]">Negotiate rates directly, no middleman.</p>
      </div>
      <div className="px-4 flex flex-col gap-2">
        {chats.length === 0 && (
          <div className="text-center py-16">
            <MessageCircle className="mx-auto mb-2" size={28} color={C.sub} />
            <p className="text-[13px] text-[#6B7268]">No conversations yet.</p>
          </div>
        )}
        {chats.map((c) => {
          const last = c.messages[c.messages.length - 1];
          const preview = last?.type === "offer" ? `${last.from === "me" ? "You" : c.person.name}: ₹${last.amount}/q`
            : last?.type === "system" ? last.text
              : last?.text || "";
          return (
            <button key={c.id} onClick={() => onOpen(c)} className="w-full text-left bg-white border border-[#E4E1D3] rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
              <div className="w-11 h-11 rounded-full bg-[#F5E3DA] flex items-center justify-center shrink-0">
                <CircleUser size={24} color={C.clay} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-semibold text-[#1B2420]">{c.person.name}</p>
                  {c.status === "ready_to_confirm" && <Pill tone="gold">Awaiting confirm</Pill>}
                  {c.status === "confirmed" && <Pill tone="up">Confirmed</Pill>}
                  {c.status === "paid" && <Pill tone="up"><Check size={11} />Paid</Pill>}
                </div>
                <p className="text-[12px] text-[#6B7268] truncate">{c.lotSummary}</p>
                <p className="text-[12px] text-[#1B2420] truncate mt-0.5">{preview}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Keypad({ initial, onCancel, onSend, label }) {
  const [val, setVal] = useState(initial ? String(initial) : "");
  const press = (d) => setVal((v) => (v + d).slice(0, 6));
  const back = () => setVal((v) => v.slice(0, -1));
  return (
    <div className="absolute inset-0 bg-black/40 flex items-end z-30">
      <div className="w-full bg-white rounded-t-3xl p-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[#1B2420]">{label}</p>
          <button onClick={onCancel}><X size={18} color={C.sub} /></button>
        </div>
        <div className="bg-[#F5F6F0] rounded-xl h-14 flex items-center px-4 mb-3">
          <span className="text-[24px] font-semibold text-[#1B2420]">₹{val || "0"}</span>
          <span className="text-[12px] text-[#6B7268] ml-1">/ quintal</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) => (
            k === "" ? <div key={i} /> :
              k === "del" ? (
                <button key={i} onClick={back} className="h-12 rounded-xl bg-[#F5F6F0] flex items-center justify-center">
                  <Delete size={18} color={C.ink} />
                </button>
              ) : (
                <button key={i} onClick={() => press(k)} className="h-12 rounded-xl bg-[#F5F6F0] text-[18px] font-semibold text-[#1B2420]">
                  {k}
                </button>
              )
          ))}
        </div>
        <button
          disabled={!val}
          onClick={() => onSend(Number(val))}
          className={`w-full h-12 rounded-xl mt-3 font-semibold text-[15px] text-white ${val ? "bg-[#1E4732]" : "bg-[#B7BDAF]"}`}
        >
          Send offer
        </button>
      </div>
    </div>
  );
}

function PaymentSheet({ amount, onClose, onPaid, role }) {
  const [paid, setPaid] = useState(false);
  return (
    <div className="absolute inset-0 bg-black/40 flex items-end z-30">
      <div className="w-full bg-white rounded-t-3xl p-5 pb-7">
        {!paid ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[17px] font-semibold text-[#1B2420]">
                {role === "buyer" ? "Confirm & pay" : "Confirmed — awaiting payment"}
              </p>
              <button onClick={onClose}><X size={18} color={C.sub} /></button>
            </div>
            <p className="text-[12px] text-[#6B7268] mb-4">Deal locked at <span className="font-semibold text-[#1B2420]">{fmtRs(amount)}/quintal</span></p>
            {role === "buyer" ? (
              <>
                <div className="flex flex-col gap-2 mb-4">
                  {["UPI — GPay / PhonePe / Paytm", "Bank transfer (NEFT)"].map((m) => (
                    <div key={m} className="flex items-center gap-3 border border-[#E4E1D3] rounded-xl px-3 py-3">
                      {m.startsWith("UPI") ? <Wallet size={18} color={C.teal} /> : <Landmark size={18} color={C.teal} />}
                      <span className="text-[13px] text-[#1B2420]">{m}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPaid(true)} className="w-full h-12 rounded-xl bg-[#1E4732] text-white font-semibold text-[15px]">
                  Pay {fmtRs(amount)}
                </button>
              </>
            ) : (
              <div className="bg-[#F5F6F0] rounded-xl p-4 flex items-center gap-3">
                <Clock size={20} color={C.sub} />
                <p className="text-[12px] text-[#6B7268]">The buyer has been asked to pay via UPI. You'll be notified the moment it lands.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#E2F1E7] flex items-center justify-center mb-3">
              <Check size={26} color={C.up} />
            </div>
            <p className="text-[17px] font-semibold text-[#1B2420]">Payment sent</p>
            <p className="text-[12px] text-[#6B7268] mt-1 mb-4">{fmtRs(amount)}/quintal · via UPI</p>
            <button onClick={() => onPaid()} className="w-full h-12 rounded-xl bg-[#1E4732] text-white font-semibold text-[15px]">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatDetailScreen({ convo, role, onSendOffer, onConfirm, onPaid }) {
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [paySheet, setPaySheet] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [convo.messages.length]);

  const verb = role === "buyer" ? "Buy at" : "Sell at";

  return (
    <div className="flex-1 flex flex-col relative min-h-0">
      <div className="px-4 py-2.5 flex items-center gap-2.5 border-b border-[#E4E1D3] bg-white">
        <div className="w-9 h-9 rounded-full bg-[#F5E3DA] flex items-center justify-center">
          <CircleUser size={20} color={C.clay} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1B2420]">{convo.person.name}</p>
          <p className="text-[11px] text-[#6B7268] truncate">{convo.lotSummary}</p>
        </div>
        <a href={`tel:${convo.person.mobile}`} className="w-8 h-8 rounded-full bg-[#F5F6F0] flex items-center justify-center">
          <Phone size={15} color={C.ink} />
        </a>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {convo.messages.map((m, i) => {
          if (m.type === "system") return (
            <div key={i} className="mx-auto my-1 px-3 py-1 rounded-full bg-[#E4ECE4] text-[#1E4732] text-[11px] font-semibold">{m.text}</div>
          );
          const mine = m.from === "me";
          return (
            <div key={i} className={`max-w-[78%] ${mine ? "self-end" : "self-start"}`}>
              <div className={`rounded-2xl px-3 py-2 ${mine ? "bg-[#1E4732] text-white rounded-br-sm" : "bg-white border border-[#E4E1D3] text-[#1B2420] rounded-bl-sm"}`}>
                {m.type === "offer" ? (
                  <p className="text-[14px] font-semibold">{fmtRs(m.amount)}<span className="opacity-70 text-[11px]">/quintal</span></p>
                ) : m.type === "accept" ? (
                  <p className="text-[13px]">Okay, confirmed at {fmtRs(m.amount)}/q ✅</p>
                ) : (
                  <p className="text-[13px]">{m.text}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#E4E1D3] bg-white px-4 py-3 flex items-center gap-2">
        {convo.status === "ready_to_confirm" ? (
          <button onClick={onConfirm} className="flex-1 h-11 rounded-xl bg-[#D98A2B] text-white font-semibold text-[14px] flex items-center justify-center gap-1.5">
            <Check size={16} /> Confirm rate {fmtRs(convo.theirOffer)}/q
          </button>
        ) : convo.status === "confirmed" ? (
          <button onClick={() => setPaySheet(true)} className="flex-1 h-11 rounded-xl bg-[#1E4732] text-white font-semibold text-[14px] flex items-center justify-center gap-1.5">
            <Wallet size={16} /> {role === "buyer" ? "Proceed to pay" : "View payment status"}
          </button>
        ) : convo.status === "paid" ? (
          <div className="flex-1 h-11 rounded-xl bg-[#E2F1E7] text-[#2C7A4B] font-semibold text-[14px] flex items-center justify-center gap-1.5">
            <Check size={16} /> Deal complete
          </div>
        ) : (
          <button onClick={() => setKeypadOpen(true)} className="flex-1 h-11 rounded-xl border border-[#1E4732] text-[#1E4732] font-semibold text-[14px]">
            {verb} — enter your rate
          </button>
        )}
      </div>

      {keypadOpen && (
        <Keypad
          initial={convo.myOffer}
          label={`${verb} (₹ / quintal)`}
          onCancel={() => setKeypadOpen(false)}
          onSend={(amt) => { onSendOffer(amt); setKeypadOpen(false); }}
        />
      )}
      {paySheet && (
        <PaymentSheet
          amount={convo.myOffer || convo.theirOffer}
          role={role}
          onClose={() => setPaySheet(false)}
          onPaid={() => { setPaySheet(false); onPaid(); }}
        />
      )}
    </div>
  );
}

/* -------------------------------- Profile ----------------------------------- */
function ProfileScreen({ role, profile, language, onLanguageChange, onSignOut }) {
  const displayName = profile?.name || (role === "farmer" ? "Farmer" : "Buyer");
  const displayPhone = profile?.phone ? profile.phone.replace("+91", "+91 ") : "—";
  const items = role === "farmer"
    ? [[Boxes, "Your crops & inventory"], [Receipt, "Past transactions"], [IdCard, "Account details"], [FileWarning, "Complaint / dispute"]]
    : [[Boxes, "Your deals & inventory"], [Receipt, "Past transactions"], [IdCard, "Account details"], [FileWarning, "Complaint / dispute"]];
  const languages = ["English", "हिन्दी", "मराठी"];

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4 bg-white border border-[#E4E1D3] rounded-2xl p-4 flex items-center gap-3">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${role === "farmer" ? "bg-[#F5E3DA]" : "bg-[#DFEBEC]"}`}>
          <CircleUser size={34} color={role === "farmer" ? C.clay : C.teal} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-semibold text-[#1B2420] truncate">{displayName}</p>
          <p className="text-[12px] text-[#6B7268] flex items-center gap-1"><Phone size={12} />{displayPhone}</p>
          <div className="flex items-center gap-1 mt-1">
            <Star size={13} color={C.gold} fill={C.gold} />
            <span className="text-[12px] font-semibold text-[#1B2420]">4.5</span>
            <span className="text-[11px] text-[#6B7268]">· AgriTrade rating</span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 bg-white border border-[#E4E1D3] rounded-2xl p-4">
        <p className="text-[12px] font-semibold text-[#1B2420] mb-2">Language</p>
        <div className="flex flex-wrap gap-2">
          {languages.map((option) => (
            <button
              key={option}
              onClick={() => onLanguageChange(option)}
              className={`px-3 py-2 rounded-full text-[12px] font-semibold border ${language === option
                ? "bg-[#1E4732] border-[#1E4732] text-white"
                : "bg-white border-[#E4E1D3] text-[#1B2420]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 bg-white border border-[#E4E1D3] rounded-2xl overflow-hidden">
        {items.map(([Icon, label], i) => (
          <button key={label} className={`w-full flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-[#EEECDF]" : ""}`}>
            <Icon size={18} color={C.ink} />
            <span className="flex-1 text-left text-[14px] text-[#1B2420]">{label}</span>
            <ChevronRight size={16} color={C.sub} />
          </button>
        ))}
      </div>

      <button
        onClick={onSignOut}
        className="mt-4 w-full h-11 rounded-xl border-2 border-[#B23B3B] text-[#B23B3B] font-semibold text-[14px] flex items-center justify-center gap-2"
      >
        Sign out
      </button>
    </div>
  );
}

function ToolsScreen({ onOpenTool }) {
  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4">
        <p className="text-[18px] font-semibold text-[#1B2420]">Farmer tools</p>
        <p className="text-[12px] text-[#6B7268] mt-1">Plan transport, compare mandi options, and review support programs.</p>
      </div>

      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        {TOOL_ITEMS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.key}
              onClick={() => onOpenTool(tool)}
              className="text-left bg-white border border-[#E4E1D3] rounded-2xl p-3.5 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-1 rounded-full bg-[#E4ECE4] text-[10px] font-semibold text-[#1E4732]">
                  {tool.badge}
                </span>
                <Icon size={18} color={C.teal} />
              </div>
              <p className="mt-3 text-[14px] font-semibold text-[#1B2420]">{tool.name}</p>
              <p className="mt-1 text-[11px] text-[#6B7268]">{tool.subtitle}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToolDetailScreen({ tool, role }) {
  const detailMap = {
    "expense-calculator": {
      title: "Expense Calculator",
      description: "Estimate the rough net profit after labour, transport, and mandi-related costs.",
      bullets: [
        "Enter quantity in quintals and expected selling price.",
        "Add labour cost, distance, and vehicle type for transport.",
        "Compare estimated profit across mandi options.",
      ],
    },
    "mandi-travel": {
      title: "Mandi Travel Expense",
      description: "Compare nearest mandis from the saved farm or buyer location and estimate travel cost.",
      bullets: [
        "Shows mandi distance and estimated ETA from the saved location.",
        "Supports transport options like mini truck, tractor, truck, and tempo.",
        "Prepares the cost comparison used in the calculator.",
      ],
    },
    "govt-schemes": {
      title: "Govt Schemes",
      description: "Browse relevant government support schemes by crop, state, or farmer category.",
      bullets: [
        "Fetch and normalize data from an external schemes source.",
        "Cache results in Supabase to reduce repeated API calls.",
        "Filter the schemes list for the farmer’s crop and location.",
      ],
    },
    "wdra-warehouse": {
      title: "WDRA Warehouse",
      description: "View nearby warehouses and storage rate references for agricultural produce.",
      bullets: [
        "Display nearest warehouses from the farmer’s location.",
        "Show estimated distance and storage cost per quintal.",
        "Connect warehouse placement with the travel expense flow.",
      ],
    },
    "supply-demand": {
      title: "Supply & Demand",
      description: "Review the last 7 days of arrivals for selected commodities to spot supply pressure.",
      bullets: [
        "Use daily arrival data from mandi records in Supabase.",
        "Present a compact bar chart for the selected commodity.",
        "Highlight sudden spikes or drops in supply.",
      ],
    },
    "map-overview": {
      title: "Map Overview",
      description: "See farm, mandi, and buyer locations together in one location-aware dashboard.",
      bullets: [
        "Store farm, mandi, and buyer coordinates for consistent distance checks.",
        "Render a unified map view for agricultural logistics.",
        "Support the final distance and buyer matching workflow.",
      ],
    },
  };

  const detail = detailMap[tool?.key] || detailMap["expense-calculator"];

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4 pt-4">
        <div className="bg-white border border-[#E4E1D3] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#6B7268]">{role === "farmer" ? "Farmer tool" : "Buyer tool"}</p>
              <p className="mt-1 text-[22px] font-semibold text-[#1B2420]">{detail.title}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#E4ECE4] flex items-center justify-center">
              {tool?.icon ? <tool.icon size={22} color={C.teal} /> : <Search size={22} color={C.teal} />}
            </div>
          </div>

          <p className="mt-3 text-[13px] text-[#6B7268]">{detail.description}</p>

          <div className="mt-4 space-y-2">
            {detail.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-2 rounded-xl bg-[#F5F6F0] px-3 py-2.5">
                <Check size={14} color={C.up} className="mt-0.5" />
                <p className="text-[12px] text-[#1B2420]">{bullet}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- shell / nav -------------------------------- */
function BottomNav({ role, active, onChange }) {
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    { key: "trade", label: role === "farmer" ? "Sell" : "Buy", icon: role === "farmer" ? Sprout : ShoppingBasket },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "tools", label: "Tools", icon: Search },
    { key: "profile", label: "Profile", icon: CircleUser },
  ];
  const accent = role === "farmer" ? C.clay : C.teal;
  return (
    <div className="h-[64px] border-t border-[#E4E1D3] bg-white flex items-stretch shrink-0">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} className="flex-1 flex flex-col items-center justify-center gap-0.5">
            <Icon size={20} color={isActive ? accent : C.sub} strokeWidth={isActive ? 2.4 : 2} />
            <span className="text-[10.5px] font-semibold" style={{ color: isActive ? accent : C.sub }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------- App ------------------------------------ */
const baseStacks = () => ({
  home: [{ name: "list" }],
  trade: [{ name: "list" }],
  chat: [{ name: "list" }],
  tools: [{ name: "list" }],
  profile: [{ name: "main" }],
});

function MainApp({ profile, onSignOut, onProfileUpdate }) {
  const [role, setRole] = useState(profile?.role || "farmer");
  const [activeTab, setActiveTab] = useState("home");
  const [stacks, setStacks] = useState(baseStacks);
  const [lots, setLots] = useState(INITIAL_LOTS);
  const [chats, setChats] = useState(INITIAL_CHATS);
  const [language, setLanguage] = useState(profile?.preferredLanguage || profile?.preferred_language || "English");

  const pushScreen = (tab, screen) => {
    setStacks((s) => ({ ...s, [tab]: [...s[tab], screen] }));
  };

  const popScreen = (tab) => {
    setStacks((s) => ({
      ...s,
      [tab]: s[tab].length > 1 ? s[tab].slice(0, -1) : s[tab],
    }));
  };

  const handlePublishLot = (newLot) => {
    setLots((prev) => [newLot, ...prev]);
    popScreen("trade");
  };

  const handleSendOffer = (convoId, amount) => {
    setChats((prev) => {
      const roleChats = prev[role] || [];
      const updated = roleChats.map((c) => {
        if (c.id !== convoId) return c;
        return {
          ...c,
          myOffer: amount,
          status: "ready_to_confirm",
          messages: [
            ...c.messages,
            { from: "me", type: "offer", amount },
          ],
        };
      });
      return { ...prev, [role]: updated };
    });
  };

  const handleConfirmOffer = (convoId) => {
    setChats((prev) => {
      const roleChats = prev[role] || [];
      const updated = roleChats.map((c) => {
        if (c.id !== convoId) return c;
        return {
          ...c,
          status: "confirmed",
          messages: [
            ...c.messages,
            { from: "me", type: "accept", amount: c.theirOffer },
            { from: "system", type: "system", text: "Rate confirmed! Ready for payment." },
          ],
        };
      });
      return { ...prev, [role]: updated };
    });
  };

  const handlePaid = (convoId) => {
    setChats((prev) => {
      const roleChats = prev[role] || [];
      const updated = roleChats.map((c) => {
        if (c.id !== convoId) return c;
        return {
          ...c,
          status: "paid",
          messages: [
            ...c.messages,
            { from: "system", type: "system", text: "Payment complete via UPI." },
          ],
        };
      });
      return { ...prev, [role]: updated };
    });
  };

  const currentStack = stacks[activeTab];
  const currentScreen = currentStack[currentStack.length - 1];

  const renderContent = () => {
    if (activeTab === "home") {
      return (
        <HomeScreen
          role={role}
          onSwitchRole={() => setRole((r) => (r === "farmer" ? "buyer" : "farmer"))}
        />
      );
    }

    if (activeTab === "trade") {
      if (currentScreen.name === "list") {
        return (
          <TradeListScreen
            role={role}
            lots={lots}
            onOpenLot={(lot) => pushScreen("trade", { name: "lot_detail", lot })}
            onCreateLot={() => pushScreen("trade", { name: "create_lot" })}
          />
        );
      }
      if (currentScreen.name === "create_lot") {
        return (
          <CreateLotScreen
            onPublish={handlePublishLot}
            onBack={() => popScreen("trade")}
          />
        );
      }
      if (currentScreen.name === "lot_detail") {
        return (
          <LotDetailScreen
            lot={currentScreen.lot}
            role={role}
            onOpenPerson={(person) => pushScreen("trade", { name: "person_detail", person, lot: currentScreen.lot })}
          />
        );
      }
      if (currentScreen.name === "person_detail") {
        return (
          <PersonDetailScreen
            person={currentScreen.person}
            lotSummary={`${currentScreen.lot.crop} · ${currentScreen.lot.qty} quintals`}
            onContact={() => {
              setActiveTab("chat");
            }}
          />
        );
      }
    }

    if (activeTab === "chat") {
      if (currentScreen.name === "list") {
        return (
          <ChatListScreen
            role={role}
            chats={chats[role] || []}
            onOpen={(convo) => pushScreen("chat", { name: "detail", convo })}
          />
        );
      }
      if (currentScreen.name === "detail") {
        const convo = (chats[role] || []).find((c) => c.id === currentScreen.convo.id) || currentScreen.convo;
        return (
          <ChatDetailScreen
            convo={convo}
            role={role}
            onSendOffer={(amt) => handleSendOffer(convo.id, amt)}
            onConfirm={() => handleConfirmOffer(convo.id)}
            onPaid={() => handlePaid(convo.id)}
          />
        );
      }
    }

    if (activeTab === "tools") {
      if (currentScreen.name === "list") {
        return <ToolsScreen onOpenTool={(tool) => pushScreen("tools", { name: "tool_detail", tool })} />;
      }
      if (currentScreen.name === "tool_detail") {
        return <ToolDetailScreen tool={currentScreen.tool} role={role} />;
      }
    }

    if (activeTab === "profile") {
      return (
        <ProfileScreen
          role={role}
          profile={profile}
          language={language}
          onLanguageChange={(nextLanguage) => {
            setLanguage(nextLanguage);
            if (onProfileUpdate) {
              onProfileUpdate((prev) => ({
                ...prev,
                preferredLanguage: nextLanguage,
                preferred_language: nextLanguage,
              }));
            }
          }}
          onSignOut={onSignOut}
        />
      );
    }

    return null;
  };

  const getTitle = () => {
    if (activeTab === "home") return "AgriTrade";
    if (activeTab === "trade") {
      if (currentScreen.name === "create_lot") return "Publish Lot";
      if (currentScreen.name === "lot_detail") return currentScreen.lot?.crop || "Lot Details";
      if (currentScreen.name === "person_detail") return currentScreen.person?.name || "Person Details";
      return role === "farmer" ? "Sell Crops" : "Buy Crops";
    }
    if (activeTab === "chat") {
      if (currentScreen.name === "detail") return currentScreen.convo?.person?.name || "Chat";
      return "Messages";
    }
    if (activeTab === "tools") {
      if (currentScreen.name === "tool_detail") return currentScreen.tool?.name || "Tool";
      return "Tools";
    }
    if (activeTab === "profile") return "Profile";
    return "AgriTrade";
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-[430px] mx-auto bg-[#F5F6F0] overflow-hidden border border-[#D8D2C3] rounded-[32px] shadow-[0_20px_50px_rgba(27,36,32,0.15)]">
      <TopBar
        title={getTitle()}
        onBack={currentStack.length > 1 ? () => popScreen(activeTab) : null}
        right={<RoleBadge role={role} />}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderContent()}
      </div>
      <BottomNav
        role={role}
        active={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
        }}
      />
    </div>
  );
}

export default function AgriTradeApp() {
  const [profile, setProfile] = useState(null);

  // On mount, check for an existing Supabase session so the user
  // doesn't have to log in again after a page refresh.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const userId = data.session.user.id;
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (existingProfile) {
        setProfile(existingProfile);
      }
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  if (!profile) {
    return <WelcomeAuth onAuthed={setProfile} />;
  }

  return (
    <TradeProvider>
      <MainApp
        profile={profile}
        onSignOut={handleSignOut}
        onProfileUpdate={setProfile}
      />
    </TradeProvider>
  );
}