import { useState, useMemo, useEffect } from "react";
import { Search, TrendingUp, ArrowRight, Loader2, Layers, X } from "lucide-react";
import { THEME_COLORS, formatCurrency } from "../constants/theme";
import { getCommodityCatalog, getCommodities } from "../services/mandiService.js";

export default function HomeScreen({ role }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [commodityCatalog, setCommodityCatalog] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommodityName, setSelectedCommodityName] = useState("");
  const [showAllCommodityPills, setShowAllCommodityPills] = useState(false);

  const VISIBLE_COMMODITY_PILLS = 12;

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getCommodityCatalog(),
      getCommodities(),
    ])
      .then(([catalogResult, priceResult]) => {
        if (!isMounted) return;

        const catalogNames = [...new Set(
          (catalogResult.data || [])
            .map((item) => (item.Name || item.name || "").trim())
            .filter(Boolean)
        )];

        setCommodityCatalog(catalogNames);
        setSelectedCommodityName((current) => current || catalogNames[0] || "");

        if (priceResult.error) {
          setCommodities([]);
          setLoading(false);
          return;
        }

        const normalized = (priceResult.data || [])
          .map((item) => ({
            ...item,
            id: item.id ?? `${item.commodity ?? 'commodity'}-${item.market ?? 'market'}-${item.arrival_date ?? ''}`,
            Name: (item.commodity || item.Commodity || item.Name || item.name || "").trim(),
            state: item.state || item.State || "—",
            district: item.district || item.District || "—",
            market: item.market || item.Market || "—",
            variety: item.variety || item.Variety || "—",
            grade: item.grade || item.Grade || "—",
            minPrice: Number(item.min_price ?? item.minPrice ?? 0),
            modalPrice: Number(item.modal_price ?? item.modalPrice ?? 0),
            maxPrice: Number(item.max_price ?? item.maxPrice ?? 0),
            price: Number(item.modal_price ?? item.modalPrice ?? item.min_price ?? item.minPrice ?? 0),
            arrivalDate: item.arrival_date || item.Arrival_Date || "—",
          }))
          .filter((item) => item.Name && (Number.isFinite(item.minPrice) || Number.isFinite(item.modalPrice) || Number.isFinite(item.maxPrice)));

        normalized.sort((a, b) => {
          const priceDiff = Number(b.modalPrice ?? 0) - Number(a.modalPrice ?? 0);
          if (priceDiff !== 0) return priceDiff;
          return String(a.Name).localeCompare(String(b.Name));
        });

        setCommodities(normalized);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setCommodityCatalog([]);
          setCommodities([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizeCommodityName = (value = "") =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const filteredCommodities = useMemo(() => {
    if (!selectedCommodityName) {
      return commodities;
    }

    const selectedNormalized = normalizeCommodityName(selectedCommodityName);

    return commodities.filter((item) => {
      const itemNormalized = normalizeCommodityName(item.Name);
      if (!itemNormalized || !selectedNormalized) return false;

      return (
        itemNormalized === selectedNormalized ||
        itemNormalized.includes(selectedNormalized) ||
        selectedNormalized.includes(itemNormalized)
      );
    });
  }, [commodities, selectedCommodityName]);

  const commodityNames = useMemo(
    () => commodityCatalog,
    [commodityCatalog]
  );

  const filteredCommodityNames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return commodityNames;
    }

    return commodityNames.filter((name) => name.toLowerCase().includes(query));
  }, [commodityNames, searchQuery]);

  const visibleCommodityNames = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredCommodityNames;
    }

    if (showAllCommodityPills) {
      return filteredCommodityNames;
    }

    return filteredCommodityNames.slice(0, VISIBLE_COMMODITY_PILLS);
  }, [filteredCommodityNames, searchQuery, showAllCommodityPills]);

  const featuredCommodity = useMemo(
    () =>
      commodities.find((item) => item.Name === selectedCommodityName) ||
      commodities[0] ||
      null,
    [commodities, selectedCommodityName]
  );

  const averagePrice = useMemo(() => {
    if (!filteredCommodities.length) return 0;

    const pricedItems = filteredCommodities.filter((item) => Number.isFinite(item.price) && item.price > 0);

    if (!pricedItems.length) return 0;

    const total = pricedItems.reduce((sum, item) => sum + item.price, 0);
    return total / pricedItems.length;
  }, [filteredCommodities]);

  const displayedCommodities = filteredCommodities;

  const themeAccent = role === "farmer" ? THEME_COLORS.clay : THEME_COLORS.teal;

  const heroPrice = averagePrice;

  return (
    <div className="h-full overflow-y-auto pb-6 bg-[#F9F8F3]">
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] text-[#6B7268]">Today's mandi prices</p>
        <div className="mt-2 flex items-center gap-2 bg-white border border-[#E4E1D3] rounded-2xl px-3 h-11 shadow-sm">
          <Search size={17} color={THEME_COLORS.sub} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search crop, variety, or type — Lokwan, Sharbati…"
            className="flex-1 bg-transparent outline-none text-[14px] text-[#1B2420] placeholder:text-[#9A9C8E]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-gray-400">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-2">
          {visibleCommodityNames.map((commodityName) => (
            <button
              key={commodityName}
              onClick={() => {
                setSelectedCommodityName(commodityName);
              }}
              className={`shrink-0 px-3.5 h-9 rounded-full text-[13px] font-semibold border transition-colors ${selectedCommodityName === commodityName
                ? "bg-[#1E4732] border-[#1E4732] text-white"
                : "bg-white border-[#E4E1D3] text-[#1B2420]"
                }`}
            >
              {commodityName}
            </button>
          ))}
        </div>

        {!searchQuery.trim() && filteredCommodityNames.length > VISIBLE_COMMODITY_PILLS && (
          <button
            onClick={() => setShowAllCommodityPills((current) => !current)}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-[#D8D2C3] bg-white px-3.5 h-9 text-[12px] font-semibold text-[#1E4732]"
          >
            {showAllCommodityPills ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <div className="mx-4 rounded-2xl bg-[#1B2420] px-4 py-4 relative overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-wide uppercase text-white/50">
              Market average · per quintal
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[30px] font-semibold text-white">
                {formatCurrency(heroPrice)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {featuredCommodity ? `Live from ${featuredCommodity.market}` : `${commodities.length} live mandi records`}
            </p>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-[#2C7A4B]/20 text-[#8FE3AC]">
            <TrendingUp size={14} />
            Live
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 bg-white border border-[#E4E1D3] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#1B2420] flex items-center gap-1.5">
            <Layers size={16} className="text-[#1E4732]" /> Mandi Price Table
          </h3>
          <span className="text-[12px] font-semibold text-[#1E4732]">
            {selectedCommodityName ? `Showing ${selectedCommodityName}` : "Select a commodity"}
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-gray-400 text-[12px] flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-[#1E4732]" /> Loading commodities…
          </div>
        ) : filteredCommodities.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-6 text-center">
            No commodities match your search.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#E4E1D3] text-[#6B7268]">
                  <th className="pb-2 pr-3 font-semibold">Commodity</th>
                  <th className="pb-2 pr-3 font-semibold">State</th>
                  <th className="pb-2 pr-3 font-semibold">District</th>
                  <th className="pb-2 pr-3 font-semibold">Market</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Min</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Modal</th>
                  <th className="pb-2 pr-3 font-semibold text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                {displayedCommodities.map((item) => (
                  <tr key={item.id} className="border-b border-[#F0EDE0] last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <button
                        onClick={() => {
                          setSelectedCommodityName(item.Name);
                        }}
                        className="font-semibold text-[#1B2420] hover:text-[#1E4732]"
                      >
                        {item.Name}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-[#6B7268]">{item.state}</td>
                    <td className="py-2.5 pr-3 text-[#6B7268]">{item.district}</td>
                    <td className="py-2.5 pr-3 text-[#6B7268]">{item.market}</td>
                    <td className="py-2.5 pr-3 text-right text-[#6B7268]">{formatCurrency(item.minPrice)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-[#1E4732]">{formatCurrency(item.modalPrice)}</td>
                    <td className="py-2.5 pr-3 text-right text-[#6B7268]">{formatCurrency(item.maxPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        className="mx-4 mt-5 w-[calc(100%-2rem)] h-11 rounded-xl text-white font-semibold text-[14px] flex items-center justify-center gap-1.5 shadow-sm"
        style={{ backgroundColor: themeAccent }}
      >
        {role === "farmer" ? "Create a lot to sell" : "Browse lots to buy"} <ArrowRight size={16} />
      </button>
    </div>
  );
}