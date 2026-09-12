import { supabase } from '../lib/supabaseClient';

/**
 * Fetch Maharashtra price data and split into FAQ-only chart data vs full table data.
 */
export async function getCropPriceTrend() {
  try {
    const { data, error } = await supabase
      .from('agmarknet_prices')
      .select('id, modal_price, min_price, max_price, arrival_date, commodity, market, state, district, variety, grade')
      .ilike('state', '%Maharashtra%')
      .order('arrival_date', { ascending: true });

    if (error) {
      console.error('[getCropPriceTrend] Error:', error);
      return { chartData: [], tableData: [], error };
    }

    const allRows = data || [];

    // 1. Table gets EVERYTHING (FAQ + Local + all varieties), newest dates first
    const tableData = [...allRows].reverse();

    // 2. Chart gets ONLY FAQ quality entries
    const faqRows = allRows.filter((row) => {
      const varietyStr = (row.variety || '').toLowerCase();
      const gradeStr = (row.grade || '').toLowerCase();

      // Match 'faq' in either grade or variety column
      return gradeStr.includes('faq') || varietyStr.includes('faq');
    });

    // Deduplicate by date (takes max price if multiple FAQ entries exist on the same date)
    const chartMap = {};
    faqRows.forEach((row) => {
      const date = row.arrival_date;
      const price = Number(row.modal_price);

      if (!chartMap[date] || price > chartMap[date].modal_price) {
        chartMap[date] = {
          arrival_date: date,
          modal_price: price,
          commodity: row.commodity
        };
      }
    });

    const chartData = Object.values(chartMap);

    return { chartData, tableData, error: null };
  } catch (err) {
    console.error('[getCropPriceTrend] Exception:', err);
    return { chartData: [], tableData: [], error: err };
  }
}