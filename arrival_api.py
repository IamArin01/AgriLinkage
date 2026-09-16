import os
import re
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

OGD_API_KEY = os.getenv("OGD_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24"


def clear_supabase_table():
    """Delete all rows from the arrival table for a full refresh."""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Clearing all existing entries from Supabase table 'agmarknet_arrival'...")
    try:
        supabase.table("agmarknet_arrival").delete().neq("id", -1).execute()
        print("Table successfully cleared!")
    except Exception as exc:
        print(f"Error clearing table: {exc}")


def get_all_commodity_names() -> list[str]:
    """Load commodity names from the arrival table, then fallback to the price table."""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    names = []
    try:
        arrival_response = supabase.table("agmarknet_arrival").select("commodity").execute()
        for row in arrival_response.data or []:
            value = (row.get("commodity") or row.get("Commodity") or "").strip()
            if value:
                names.append(value)
    except Exception as exc:
        print(f"Warning: Unable to load arrival commodity list from Supabase: {exc}")

    if names:
        return sorted(set(names))

    try:
        price_response = supabase.table("agmarknet_prices").select("commodity").execute()
        for row in price_response.data or []:
            value = (row.get("commodity") or row.get("Commodity") or "").strip()
            if value:
                names.append(value)
    except Exception as exc:
        print(f"Warning: Unable to load fallback commodity list from agmarknet_prices: {exc}")

    return sorted(set(names))


def parse_date(date_str: str):
    if not date_str:
        return None
    try:
        return datetime.strptime(str(date_str).strip(), "%d/%m/%Y").strftime("%Y-%m-%d")
    except Exception:
        return str(date_str)


def parse_number(value):
    if value is None or value == "":
        return None
    try:
        cleaned = str(value).replace(",", "").strip()
        if cleaned in {"", "-", "--"}:
            return None
        parsed = float(cleaned)
        return parsed if parsed == parsed else None
    except (TypeError, ValueError):
        return None


def normalize_text(value) -> str:
    return " ".join(str(value or "").casefold().replace("-", " ").split())


def commodity_matches(requested, returned) -> bool:
    requested_text = normalize_text(requested)
    returned_text = normalize_text(returned)
    return bool(requested_text and returned_text and (requested_text in returned_text or returned_text in requested_text))


def provider_commodity_name(value) -> str:
    return re.sub(r"\s*\([^)]*\)", "", str(value or "")).strip()


def normalize_lookup_key(value) -> str:
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def pick_value(row, keys):
    normalized_map = {normalize_lookup_key(key): value for key, value in row.items()}

    for key in keys:
        lookup_key = normalize_lookup_key(key)
        if lookup_key in normalized_map and normalized_map[lookup_key] not in (None, ""):
            return normalized_map[lookup_key]

    for key, value in row.items():
        key_lookup = normalize_lookup_key(key)
        for candidate in keys:
            if key_lookup == normalize_lookup_key(candidate) and value not in (None, ""):
                return value

    return None


def extract_arrival_quantity(row) -> float:
    if not isinstance(row, dict):
        return None

    candidate_aliases = [
        "arrivalquantity",
        "arrivalqty",
        "arrivalquantityinqtl",
        "arrivalquantityqtls",
        "arrival_qty",
        "arrivalquantitykg",
        "arrivalqtykg",
        "arrival",
        "arrivals",
        "totalarrival",
        "totalarrivalquantity",
        "quantity",
        "qty",
        "total_qty",
        "totalquantity",
    ]

    normalized_map = {normalize_lookup_key(key): value for key, value in row.items()}
    for alias in candidate_aliases:
        if alias in normalized_map and normalized_map[alias] not in (None, ""):
            parsed = parse_number(normalized_map[alias])
            if parsed is not None:
                return parsed

    # Fallback: scan any key that contains arrival/qty/quantity terms
    for key, value in row.items():
        key_lookup = normalize_lookup_key(key)
        if (
            "arrival" in key_lookup and ("qty" in key_lookup or "quantity" in key_lookup or "arrivals" in key_lookup)
        ) or ("qty" in key_lookup and "arrival" in key_lookup):
            parsed = parse_number(value)
            if parsed is not None:
                return parsed

        if key_lookup in {"quantity", "qty", "totalquantity", "totalqty"}:
            parsed = parse_number(value)
            if parsed is not None:
                return parsed

    return None


def fetch_agmarknet_date_range(api_key: str, target_state: str = None, target_commodities: list = None, days_back: int = 7, batch_limit: int = 50, max_scan_cap_per_day: int = 1000) -> list:
    base_url = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    all_records = []
    today = datetime.now()

    print(f"--- Starting arrival fetch (Past {days_back} Days) ---")
    print(f"State: {target_state or 'ALL'} | Commodities: {target_commodities or 'ALL'}\n")

    for i in range(days_back):
        date_obj = today - timedelta(days=i)
        target_date_str = date_obj.strftime("%d/%m/%Y")
        offset = 0

        while True:
            params = {
                "api-key": api_key,
                "format": "json",
                "limit": batch_limit,
                "offset": offset,
                "filters[Arrival_Date]": target_date_str,
            }

            if target_state:
                params["filters[State]"] = target_state
            if target_commodities and len(target_commodities) == 1:
                params["filters[Commodity]"] = provider_commodity_name(target_commodities[0])

            response_json = None
            for attempt in range(1, 4):
                try:
                    res = requests.get(base_url, params=params, headers=headers, timeout=(10, 45))
                    if res.status_code == 200:
                        response_json = res.json()
                        break
                    print(f"  API returned HTTP {res.status_code} for {target_date_str} (attempt {attempt}/3)")
                except requests.RequestException as error:
                    print(f"  API request failed for {target_date_str} (attempt {attempt}/3): {error}")
                if attempt < 3:
                    time.sleep(attempt * 2)

            if not response_json:
                print(f"  Skipping {target_date_str}: no usable API response.")
                break

            records = response_json.get("records", [])
            if not records:
                break

            for record in records:
                commodity_name = (record.get("commodity") or record.get("Commodity") or "").strip()
                market_name = (record.get("market") or record.get("Market") or "").strip()
                district_name = (record.get("district") or record.get("District") or "").strip()
                arrival_date = record.get("arrival_date") or record.get("Arrival_Date") or record.get("arrival date")

                if not commodity_name or not market_name or not arrival_date:
                    continue

                if target_commodities:
                    commodity_match = any(commodity_matches(target_name, commodity_name) for target_name in target_commodities)
                    if not commodity_match:
                        continue

                all_records.append(record)

            total_available = int(response_json.get("total") or 0)
            offset += len(records)

            if (total_available and offset >= total_available) or len(records) < batch_limit or offset >= max_scan_cap_per_day:
                break

            time.sleep(0.1)

    return all_records


def transform_data(raw_records: list) -> list:
    cleaned = []
    skipped_count = 0

    for record in raw_records:
        commodity = pick_value(record, ["commodity", "Commodity"]) or ""
        district = pick_value(record, ["district", "District"]) or ""
        market = pick_value(record, ["market", "Market"]) or ""
        arrival_date = pick_value(record, ["arrival_date", "Arrival_Date", "arrival date", "Arrival Date"]) or ""
        arrival_grade = pick_value(record, ["grade", "Grade", "arrival grade", "arrival_grade", "Arrival Grade"]) or ""
        arrival_quantity = extract_arrival_quantity(record)

        if not (commodity and market and arrival_date):
            skipped_count += 1
            continue

        if arrival_quantity is None:
            print(f"Warning: missing arrival quantity for commodity={commodity}, market={market}, date={arrival_date}. Raw keys: {list(record.keys())[:12]}")

        cleaned.append({
            "commodity": str(commodity).strip(),
            "district": str(district).strip(),
            "market": str(market).strip(),
            "arrival date": parse_date(arrival_date),
            "arrival grade": str(arrival_grade).strip(),
            "arrival quantity": arrival_quantity,
            "created at": datetime.now(timezone.utc).isoformat(),
        })

    if skipped_count:
        print(f"Skipped {skipped_count} records missing commodity, market, or arrival date.")

    return cleaned


def deduplicate_records(data: list) -> list:
    seen = set()
    unique_records = []

    for item in data:
        key = (
            (item.get("commodity") or ""),
            (item.get("market") or ""),
            (item.get("district") or ""),
            (item.get("arrival date") or ""),
            (item.get("arrival grade") or ""),
        )
        if key not in seen:
            seen.add(key)
            unique_records.append(item)

    print(f"Deduplicated payload: {len(data)} total -> {len(unique_records)} unique records.")
    return unique_records


def upload_to_supabase(data: list, drop_existing: bool = False):
    if not data:
        print("\nNo valid arrival records collected to upload.")
        return

    clean_unique_data = deduplicate_records(data)
    sorted_data = sorted(clean_unique_data, key=lambda item: item.get("arrival date") or "")

    if drop_existing:
        clear_supabase_table()

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"\nUpserting {len(sorted_data)} arrival entries to Supabase table 'agmarknet_arrival'...")

    batch_size = 100
    for i in range(0, len(sorted_data), batch_size):
        batch = sorted_data[i:i + batch_size]
        try:
            payload = []
            for row in batch:
                payload.append({
                    "commodity": row.get("commodity"),
                    "district": row.get("district"),
                    "market": row.get("market"),
                    "arrival date": row.get("arrival date"),
                    "arrival grade": row.get("arrival grade"),
                    "arrival quantity": row.get("arrival quantity"),
                    "created at": row.get("created at"),
                })
            try:
                supabase.table("agmarknet_arrival").upsert(
                    payload,
                    on_conflict="commodity,market,district,arrival_date,arrival_grade",
                ).execute()
                print(f"  Batch {i // batch_size + 1} upserted successfully.")
            except Exception:
                try:
                    supabase.table("agmarknet_arrival").upsert(
                        payload,
                        on_conflict='commodity,market,district,"arrival date","arrival grade"',
                    ).execute()
                    print(f"  Batch {i // batch_size + 1} upserted successfully with quoted conflict keys.")
                except Exception:
                    supabase.table("agmarknet_arrival").insert(payload).execute()
                    print(f"  Batch {i // batch_size + 1} inserted successfully (duplicate-safe upsert fallback).")
        except Exception as exc:
            print(f"  Batch upload error: {exc}")
            raise


if __name__ == "__main__":
    if not all([OGD_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
        raise ValueError("Check your .env file for missing variables.")

    commodity_names = get_all_commodity_names()
    if not commodity_names:
        raise ValueError("No commodity names were found in agmarknet_arrival or agmarknet_prices.")

    all_raw_records = []
    for commodity in commodity_names:
        print(f"\n=== Fetching arrival data for commodity: {commodity} ===")
        raw_records = fetch_agmarknet_date_range(
            api_key=OGD_API_KEY,
            target_state="Maharashtra",
            target_commodities=[commodity],
            days_back=7,
            max_scan_cap_per_day=1000,
        )
        print(f"  -> Collected {len(raw_records)} raw arrival records for {commodity}")
        all_raw_records.extend(raw_records)

    cleaned_data = transform_data(all_raw_records)
    upload_to_supabase(cleaned_data, drop_existing=False)

    print(f"\nIncremental arrival ingestion finished successfully for {len(commodity_names)} commodities.")
