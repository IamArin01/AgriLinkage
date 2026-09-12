import React, { useState, useMemo, useEffect } from "react";
import { Search, TrendingUp, TrendingDown, ArrowRight, Loader2, MapPin } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { CROPS, THEME_COLORS, formatCurrency } from "../constants/theme";
import { getCropPriceTrend } from "../services/mandiService.js";

export function HomeScreen({ role }) {
  const [selectedCropId, setSelectedCropId] = useState("masoor");
  const [searchQuery, setSearchQuery] = useState("");
  const [tableRows, setTableRows] = useState([]);
  const [faqChartRows, setFaqChartRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedCrop = useMemo(
    () => CROPS.find((c) => c.id === "masoor") || CROPS[0],
    []
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getCropPriceTrend().then(({ chartData, tableData, error }) => {
      if (!isMounted) return;

      if (!error) {
        setFaqChartRows(chartData || []);
        setTableRows(tableData || []);
      } else {
        setFaqChartRows([]);
        setTableRows([]);
      }
      setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Format FAQ-only chart points for Recharts
  const formattedChartData = useMemo(() => {
    return faqChartRows.map((row) => {
      const d = new Date(row.arrival_date);
      return {
        day: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        price: Number(row.modal_price),
        fullDate: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      };
    });
  }, [faqChartRows]);

  const filteredCrops = useMemo(
    () => CROPS.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery]
  );

  const themeAccent = role === "farmer" ? THEME_COLORS.clay : THEME_COLORS.teal;

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      {/* Search Header */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] text-[#6B7268]">Today's mandi prices</p>
        <div className="mt-2 flex items-center gap-2 bg-white border border-[#E4E1D3] rounded-2xl px-3 h-11">
          <Search size={17} color={THEME_COLORS.sub} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search crop — Arhar, Masoor, Chana…"
            className="flex-1 bg-transparent outline-none text-[14px] text-[#1B2420] placeholder:text-[#9A9C8E]"
          />
        </div>
      </div>

      {/* Crop Pills */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {filteredCrops.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCropId(c.id)}
            className={`shrink-0 px-3.5 h-9 rounded-full text-[13px] font-semibold border transition-colors ${selectedCropId === c.id
              ? "bg-[#1E4732] border-[#1E4732] text-white"
              : "bg-white border-[#E4E1D3] text-[#1B2420]"
              }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Hero Card */}
      <div className="mx-4 rounded-2xl bg-[#1B2420] px-4 py-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] tracking-wide uppercase text-white/50">
              Masoor · per quintal
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[34px] font-semibold text-white">
                {formatCurrency(selectedCrop.price)}
              </span>
            </div>
          </div>
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-semibold ${selectedCrop.change >= 0
              ? "bg-[#2C7A4B]/20 text-[#8FE3AC]"
              : "bg-[#B23B3B]/20 text-[#F3A5A5]"
              }`}
          >
            {selectedCrop.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {selectedCrop.change >= 0 ? "+" : ""}
            {selectedCrop.change}
          </div>
        </div>
      </div>

      {/* Recharts Area Chart - FAQ Quality Only */}
      <div className="mx-4 mt-3 bg-white border border-[#E4E1D3] rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[12px] font-semibold text-[#1B2420]">
            Masoor Price Trend (FAQ Grade)
          </p>
          <span className="text-[10px] bg-[#1E4732]/10 text-[#1E4732] font-medium px-2 py-0.5 rounded-full">
            FAQ Quality
          </span>
        </div>
        <div className="relative w-full h-[110px] min-h-[110px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 rounded-xl">
              <Loader2 size={24} className="animate-spin text-[#1E4732]" />
            </div>
          )}

          {!loading && formattedChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-gray-400">
              No FAQ quality price records found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={110} minWidth={100} minHeight={110}>
              <AreaChart data={formattedChartData} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: THEME_COLORS.sub }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(v) => [formatCurrency(v), "FAQ Price"]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullDate || ''}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={THEME_COLORS.gold}
                  fillOpacity={0.2}
                  fill={THEME_COLORS.gold}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detailed Mandi Table - Shows ALL Varieties (FAQ + Local) */}
      <div className="mx-4 mt-4 bg-white border border-[#E4E1D3] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#1B2420] flex items-center gap-1.5">
            <MapPin size={16} className="text-[#1E4732]" /> Mandi Price Breakdown
          </h3>
          <span className="text-[11px] text-[#6B7268]">{tableRows.length} Records</span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-gray-400 text-[12px] flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-[#1E4732]" /> Loading mandi rates…
          </div>
        ) : tableRows.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-4 text-center">No mandi breakdown data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-[#E4E1D3] text-[#6B7268] font-semibold">
                  <th className="pb-2">Market / Location</th>
                  <th className="pb-2">Variety / Grade</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Modal Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE0]">
                {tableRows.map((row) => (
                  <tr key={row.id || `${row.market}-${row.arrival_date}-${row.variety}`} className="hover:bg-[#F9F8F3] transition-colors">
                    <td className="py-2.5">
                      <p className="font-semibold text-[#1B2420]">{row.market}</p>
                      <p className="text-[10px] text-[#6B7268]">{row.district}, {row.state}</p>
                    </td>
                    <td className="py-2.5 text-[#1B2420]">
                      <span className="font-medium">{row.variety || row.commodity}</span>
                      {row.grade && (
                        <span className="block text-[10px] text-[#6B7268]">Grade: {row.grade}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-[#6B7268] whitespace-nowrap">
                      {new Date(row.arrival_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-2.5 text-right font-bold text-[#1E4732] whitespace-nowrap">
                      {formatCurrency(row.modal_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        className="mx-4 mt-4 w-[calc(100%-2rem)] h-11 rounded-xl text-white font-semibold text-[14px] flex items-center justify-center gap-1.5"
        style={{ backgroundColor: themeAccent }}
      >
        {role === "farmer" ? "Create a lot to sell" : "Browse lots to buy"} <ArrowRight size={16} />
      </button>
    </div>
  );
}