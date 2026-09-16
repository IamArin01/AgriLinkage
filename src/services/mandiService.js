import { supabase } from '../lib/supabaseClient';

const MANDI_TABLE_CANDIDATES = [
  'Mandi',
];

const SCHEME_TABLE_CANDIDATES = [
  'Farmers Scheme',
];

const WAREHOUSE_TABLE_CANDIDATES = [
  'Warehouses',
];

function pickValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function calculateDistanceKm(fromLat, fromLon, toLat, toLon) {
  if ([fromLat, fromLon, toLat, toLon].some((value) => value == null || !Number.isFinite(Number(value)))) {
    return null;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(Number(toLat) - Number(fromLat));
  const longitudeDelta = toRadians(Number(toLon) - Number(fromLon));
  const fromLatitude = toRadians(Number(fromLat));
  const toLatitude = toRadians(Number(toLat));
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(fromLatitude) * Math.cos(toLatitude);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getNearbyMandis(mandis = [], profile = {}, limit = 10) {
  const profileCity = String(profile.city || '').trim().toLowerCase();
  const profileDistrict = String(profile.district || '').trim().toLowerCase();
  const hasProfileCoordinates = profile.latitude != null && profile.longitude != null;

  return mandis
    .map((mandi) => {
      const distanceKm = calculateDistanceKm(
        profile.latitude,
        profile.longitude,
        mandi.latitude,
        mandi.longitude,
      );
      const mandiLocation = String(mandi.location || '').toLowerCase();
      const mandiDistrict = String(mandi.district || '').toLowerCase();
      const locationMatch = Boolean(
        (profileCity && (mandiLocation.includes(profileCity) || mandiDistrict.includes(profileCity)))
        || (profileDistrict && (mandiLocation.includes(profileDistrict) || mandiDistrict.includes(profileDistrict)))
      );

      return { ...mandi, distanceKm, locationMatch };
    })
    .sort((first, second) => {
      if (hasProfileCoordinates) {
        if (first.distanceKm == null) return 1;
        if (second.distanceKm == null) return -1;
        return first.distanceKm - second.distanceKm;
      }

      if (first.locationMatch !== second.locationMatch) {
        return first.locationMatch ? -1 : 1;
      }
      return String(first.name).localeCompare(String(second.name));
    })
    .slice(0, limit);
}

export function getNearbyWarehouses(warehouses = [], profile = {}, limit = 10) {
  const hasProfileCoordinates = profile.latitude != null && profile.longitude != null;

  return warehouses
    .map((warehouse) => ({
      ...warehouse,
      distanceKm: calculateDistanceKm(
        profile.latitude,
        profile.longitude,
        warehouse.latitude,
        warehouse.longitude,
      ),
    }))
    .sort((first, second) => {
      if (hasProfileCoordinates) {
        if (first.distanceKm == null) return 1;
        if (second.distanceKm == null) return -1;
        return first.distanceKm - second.distanceKm;
      }
      return String(first.name).localeCompare(String(second.name));
    })
    .slice(0, limit);
}

function normalizeMandiRows(rows = []) {
  return rows
    .map((row, index) => {
      const name = pickValue(row, ['Name', 'name', 'Mandi Name', 'mandi_name']) || `Mandi ${index + 1}`;
      const district = pickValue(row, ['District', 'district']) || '—';
      const location = pickValue(row, ['Location', 'location', 'City', 'city', 'Address', 'address']) || district;
      const latitude = toNumber(pickValue(row, ['lat', 'latitude', 'Latitude']));
      const longitude = toNumber(pickValue(row, ['long', 'lng', 'longitude', 'Longitude']));

      return {
        id: pickValue(row, ['id', 'Id']) || `${name}-${index}`,
        name,
        district,
        location,
        latitude,
        longitude,
      };
    })
    .filter((item) => item.name);
}

function normalizeSchemeRows(rows = []) {
  return rows
    .map((row, index) => {
      const title = pickValue(row, ['scheme name', 'Scheme Name', 'scheme_name', 'name', 'title']) || `Scheme ${index + 1}`;
      const category = pickValue(row, ['category', 'Category']) || 'General';
      const district = pickValue(row, ['district', 'District']) || 'Maharashtra';
      const state = pickValue(row, ['state', 'State']) || 'Maharashtra';
      const criteria = pickValue(row, [
        'core eligibility criteria',
        'Core Eligibility Criteria',
        'core_eligibility_criteria',
        'eligibility_criteria',
      ]);
      const benefit = pickValue(row, [
        'primary benefit',
        'Primary Benefit',
        'primary_benefit',
        'benefit',
      ]);
      const subsidySlabs = pickValue(row, [
        'subsidy slabs',
        'Subsidy Slabs',
        'subsidy_slabs',
        'subsidy',
      ]);

      const description = [criteria, benefit, subsidySlabs].filter(Boolean).join(' • ');

      return {
        id: pickValue(row, ['id', 'Id']) || `${title}-${index}`,
        title,
        category,
        crop: pickValue(row, ['crop', 'Crop']) || 'All crops',
        state,
        district,
        description,
        eligibilityCriteria: criteria || '',
        primaryBenefit: benefit || '',
        subsidySlabs: subsidySlabs || '',
      };
    })
    .filter((item) => item.title);
}

function normalizeWarehouseRows(rows = []) {
  return rows
    .map((row, index) => {
      const name = pickValue(row, ['WH Name', 'WH name', 'name', 'warehouse_name', 'Warehouse Name']) || `Warehouse ${index + 1}`;
      const whId = pickValue(row, ['WH ID', 'WH_ID', 'wh_id', 'id']) || `${name}-${index}`;
      const district = pickValue(row, ['District', 'district']) || '—';
      const address = pickValue(row, ['Address', 'address', 'WH Address']) || '—';
      const status = pickValue(row, ['Status', 'status']) || 'Active';
      const capacity = pickValue(row, ['Capacity (in MT)', 'Capacity in MT', 'capacity', 'Capacity']) || '—';
      const contactNo = pickValue(row, ['Contact No', 'Contact No.', 'contact_no', 'contact']) || '—';
      const whmName = pickValue(row, ['WHM name', 'WHM Name', 'whm_name']) || '';
      const latitude = toNumber(pickValue(row, ['lat', 'latitude', 'Latitude']));
      const longitude = toNumber(pickValue(row, ['long', 'lng', 'longitude', 'Longitude']));

      return {
        id: whId,
        name,
        whmName,
        district,
        address,
        status,
        capacity,
        contactNo,
        latitude,
        longitude,
      };
    })
    .filter((item) => item.name);
}

async function queryFirstAvailable(tables, select = '*') {
  const errors = [];
  let lastResponse = { data: [], error: null };

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(select);

      if (error) {
        errors.push({ tableName, error });
        continue;
      }

      const rows = data ?? [];
      lastResponse = { data: rows, error: null };

      if (rows.length > 0) {
        return { data: rows, error: null };
      }
    } catch (error) {
      errors.push({ tableName, error });
    }
  }

  const lastError = errors.at(-1)?.error;
  return {
    data: lastResponse.data ?? [],
    error: lastError || new Error('No matching Supabase table found with rows.'),
  };
}

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

function pickFirstDefined(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function normalizeArrivalDateValue(row) {
  const value = pickFirstDefined(row, ['arrival_date', 'arrival date', 'Arrival_Date', 'Arrival Date']);
  if (value === undefined || value === null || value === '') return null;

  const dateString = String(value).trim();
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normalizeArrivalQuantityValue(row) {
  const rawValue = pickFirstDefined(row, ['arrival_quantity', 'arrival quantity', 'Arrival_Quantity', 'Arrival Quantity', 'arrival_qty', 'arrivalQty']);
  if (rawValue === undefined || rawValue === null || rawValue === '') return 0;

  const compactValue = String(rawValue).replace(/,/g, '').trim();
  const parsed = Number(compactValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCommodityName(value) {
  return String(value ?? '').trim();
}

export async function getCommodityArrivalSeries(commodityName = '', limit = 7) {
  const normalizedCommodity = String(commodityName || '').trim();

  try {
    const { data, error } = await supabase
      .from('agmarknet_arrival')
      .select('*');

    if (error) {
      console.error('[getCommodityArrivalSeries] Error:', error);
      return { data: [], error };
    }

    const rows = (data || []).filter((row) => {
      if (!normalizedCommodity) return true;
      const commodityValue = normalizeCommodityName(pickFirstDefined(row, ['commodity', 'Commodity']));
      return commodityValue.toLowerCase().includes(normalizedCommodity.toLowerCase());
    });

    const grouped = new Map();

    rows.forEach((row) => {
      const dateKey = normalizeArrivalDateValue(row);
      const commodityValue = normalizeCommodityName(pickFirstDefined(row, ['commodity', 'Commodity']));
      if (!dateKey || !commodityValue) return;

      const parsedDate = new Date(dateKey);
      const dayKey = parsedDate.toISOString().slice(0, 10);
      const existing = grouped.get(dayKey) || {
        date: dayKey,
        label: parsedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        arrivals: 0,
        totalArrivalQty: 0,
      };

      const arrivalQty = normalizeArrivalQuantityValue(row);
      existing.arrivals += 1;
      existing.totalArrivalQty += arrivalQty;
      grouped.set(dayKey, existing);
    });

    const series = [...grouped.values()]
      .sort((first, second) => new Date(first.date) - new Date(second.date))
      .slice(-Math.max(1, Number(limit) || 7))
      .map((entry) => ({
        day: entry.label,
        arrivals: Number(entry.totalArrivalQty || 0),
        avgModalPrice: 0,
      }));

    return { data: series, error: null };
  } catch (err) {
    console.error('[getCommodityArrivalSeries] Exception:', err);
    return { data: [], error: err };
  }
}

export async function getArrivalCommodities() {
  try {
    const { data, error } = await supabase
      .from('agmarknet_arrival')
      .select('*');

    if (error) {
      console.error('[getArrivalCommodities] Supabase Error:', error);
      return { data: [], error };
    }

    const values = [...new Set(
      (data || [])
        .map((row) => normalizeCommodityName(pickFirstDefined(row, ['commodity', 'Commodity'])))
        .filter(Boolean),
    )].sort((first, second) => first.localeCompare(second));

    return { data: values, error: null };
  } catch (err) {
    console.error('[getArrivalCommodities] Exception:', err);
    return { data: [], error: err };
  }
}

/**
 * Fetch mandi locations from the configured supabase table.
 */
export async function getMandiLocations() {
  try {
    const { data, error } = await queryFirstAvailable(MANDI_TABLE_CANDIDATES);

    if (error) {
      console.warn('[getMandiLocations] Could not find any mandi table:', error);
      return { data: [], error };
    }

    return { data: normalizeMandiRows(data), error: null };
  } catch (err) {
    console.error('[getMandiLocations] Exception:', err);
    return { data: [], error: err };
  }
}

/**
 * Fetch government schemes from the configured supabase table.
 */
export async function getGovernmentSchemes() {
  try {
    const { data, error } = await queryFirstAvailable(SCHEME_TABLE_CANDIDATES);

    if (error) {
      console.warn('[getGovernmentSchemes] Could not find any schemes table:', error);
      return { data: [], error };
    }

    return { data: normalizeSchemeRows(data), error: null };
  } catch (err) {
    console.error('[getGovernmentSchemes] Exception:', err);
    return { data: [], error: err };
  }
}

/**
 * Fetch warehouses from the configured supabase table.
 */
export async function getWarehouses() {
  try {
    const { data, error } = await queryFirstAvailable(WAREHOUSE_TABLE_CANDIDATES);

    if (error) {
      console.warn('[getWarehouses] Could not find any warehouse table:', error);
      return { data: [], error };
    }

    return { data: normalizeWarehouseRows(data), error: null };
  } catch (err) {
    console.error('[getWarehouses] Exception:', err);
    return { data: [], error: err };
  }
}