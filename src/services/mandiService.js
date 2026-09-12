import { supabase } from '../lib/supabaseClient';

/**
 * Fetch all commodity names from public.Commodity table.
 */
export async function getCommodityCatalog() {
  try {
    const { data, error } = await supabase
      .from('Commodity')
      .select('id, Name')
      .order('Name', { ascending: true });

    if (error) {
      console.error('[getCommodityCatalog] Supabase Error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[getCommodityCatalog] Exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch all commodity market records from public.agmarknet_prices table.
 */
export async function getCommodities() {
  try {
    const { data, error } = await supabase
      .from('agmarknet_prices')
      .select('id, state, district, market, commodity, min_price, modal_price, max_price, arrival_date, variety, grade')
      .order('arrival_date', { ascending: false });

    if (error) {
      console.error('[getCommodities] Supabase Error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[getCommodities] Exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch price trends from public.agmarknet_prices
 */
export async function getCropPriceTrend(commodityName = '') {
  try {
    const { data, error } = await supabase
      .from('agmarknet_prices')
      .select('modal_price, arrival_date, commodity, market')
      .ilike('commodity', `%${commodityName}%`)
      .order('arrival_date', { ascending: false })
      .limit(7);

    if (error) {
      console.error('[getCropPriceTrend] Error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[getCropPriceTrend] Exception:', err);
    return { data: null, error: err };
  }
}