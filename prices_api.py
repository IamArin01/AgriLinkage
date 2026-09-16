import os
import re
import time
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

OGD_API_KEY = os.getenv("OGD_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24"

def clear_supabase_table():
    """
    Deletes all existing entries from the agmarknet_prices table.
    """
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Clearing all existing entries from Supabase table 'agmarknet_prices'...")
    try:
        # Delete every record where ID is not -1 (clears the whole table)
        supabase.table("agmarknet_prices").delete().neq("id", -1).execute()
        print("Table successfully cleared!")
    except Exception as e:
        print(f"Error clearing table: {e}")


def get_all_commodity_names() -> list[str]:
    """
    Reads the commodity catalog from Supabase and returns a deduplicated list of names.
    If the catalog is unavailable, it falls back to existing agmarknet_prices rows.
    """
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        catalog_response = supabase.table("Commodity").select("Name").execute()
        catalog_rows = catalog_response.data or []
    except Exception as exc:
        print(f"Warning: Unable to load Commodity catalog from Supabase: {exc}")
        catalog_rows = []

    names = []
    for row in catalog_rows:
        value = (row.get("Name") or row.get("name") or "").strip()
        if value:
            names.append(value)

    if names:
        unique_names = sorted(set(names))
        print(f"Loaded {len(unique_names)} commodity names from the Commodity catalog.")
        return unique_names

    try:
        fallback_response = supabase.table("agmarknet_prices").select("commodity").execute()
        fallback_rows = fallback_response.data or []
    except Exception as exc:
        print(f"Warning: Unable to load fallback commodity list from agmarknet_prices: {exc}")
        fallback_rows = []

    fallback_names = []
    for row in fallback_rows:
        value = (row.get("commodity") or row.get("Commodity") or "").strip()
        if value:
            fallback_names.append(value)

    unique_names = sorted(set(fallback_names))
    print(f"Loaded {len(unique_names)} commodity names from existing agmarknet_prices data.")
    return unique_names


def parse_date(date_str: str) -> str:
    """Converts DD/MM/YYYY to YYYY-MM-DD for Supabase DATE compatibility."""
    if not date_str:
        return None
    try:
        return datetime.strptime(str(date_str).strip(), "%d/%m/%Y").strftime("%Y-%m-%d")
    except Exception:
        return str(date_str)


def parse_float(val) -> float:
    """Safely converts price strings to numeric floats."""
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def normalize_text(value) -> str:
    """Normalizes provider and catalog text before comparing names."""
    return " ".join(str(value or "").casefold().replace("-", " ").split())


def commodity_matches(requested, returned) -> bool:
    requested_text = normalize_text(requested)
    returned_text = normalize_text(returned)
    return bool(
        requested_text
        and returned_text
        and (requested_text in returned_text or returned_text in requested_text)
    )


def provider_commodity_name(value) -> str:
    """Uses the base commodity name for the provider's exact filter."""
    return re.sub(r"\s*\([^)]*\)", "", str(value or "")).strip()


def fetch_agmarknet_date_range(
    api_key: str, 
    target_state: str = None, 
    target_commodities: list = None,
    target_markets: list = None,  # <--- ADD THIS PARAMETER
    days_back: int = 7,
    batch_limit: int = 50,
    max_scan_cap_per_day: int = 1000
) -> list:
    base_url = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
    }

    all_records = []
    today = datetime.now()

    print(f"--- Starting Weekly Data Fetch (Past {days_back} Days) ---")
    print(f"State: {target_state or 'ALL'} | Markets: {target_markets or 'ALL'} | Commodities: {target_commodities or 'ALL'}\n")

    for i in range(days_back):
        date_obj = today - timedelta(days=i)
        target_date_str = date_obj.strftime("%d/%m/%Y")
        
        offset = 0
        date_records_found = 0

        print(f"Checking date: {target_date_str}...")

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

            # Filter locally by Market & Commodity
            for r in records:
                comm = (r.get("commodity") or r.get("Commodity") or "").lower()
                market_name = (r.get("market") or r.get("Market") or "").lower()

                # Match commodity condition
                comm_match = True
                if target_commodities:
                    comm_match = any(commodity_matches(t, comm) for t in target_commodities)

                # Match market condition
                market_match = True
                if target_markets:
                    market_match = any(m.lower() in market_name for m in target_markets)

                if comm_match and market_match:
                    all_records.append(r)
                    date_records_found += 1

            total_available = int(response_json.get("total") or 0)
            offset += len(records)

            if (
                (total_available and offset >= total_available)
                or len(records) < batch_limit
                or offset >= max_scan_cap_per_day
            ):
                break

            time.sleep(0.1)

        print(f"  -> Found {date_records_found} matching records for {target_date_str}")

    return all_records


def transform_data(raw_records: list) -> list:
    """Transforms raw records to fit schema."""
    clean_list = []
    skipped_count = 0
    for r in raw_records:
        state_v = r.get("state") or r.get("State")
        district_v = r.get("district") or r.get("District")
        market_v = r.get("market") or r.get("Market")
        commodity_v = r.get("commodity") or r.get("Commodity")
        variety_v = r.get("variety") or r.get("Variety") or ""
        grade_v = r.get("grade") or r.get("Grade") or ""
        date_v = r.get("arrival_date") or r.get("Arrival_Date")

        min_p = r.get("min_price") or r.get("Min_Price")
        max_p = r.get("max_price") or r.get("Max_Price")
        modal_p = r.get("modal_price") or r.get("Modal_Price")

        if not (market_v and commodity_v and date_v):
            skipped_count += 1
            continue

        clean_list.append({
            "state": state_v,
            "district": district_v,
            "market": market_v,
            "commodity": commodity_v,
            "variety": variety_v,
            "grade": grade_v,
            "arrival_date": parse_date(date_v),
            "min_price": parse_float(min_p),
            "max_price": parse_float(max_p),
            "modal_price": parse_float(modal_p)
        })

    if skipped_count:
        print(f"Skipped {skipped_count} records missing market, commodity, or arrival date.")

    return clean_list


def deduplicate_records(data: list) -> list:
    """
    Removes duplicate records based on the normalized row key:
    (commodity, market, district, variety, grade, arrival_date)
    """
    seen = set()
    unique_data = []

    for item in data:
        key = (
            item.get("commodity") or "",
            item.get("market") or "",
            item.get("district") or "",
            item.get("variety") or "",
            item.get("grade") or "",
            item.get("arrival_date") or "",
        )
        if key not in seen:
            seen.add(key)
            unique_data.append(item)

    print(f"\nDeduplicated payload: {len(data)} total -> {len(unique_data)} unique records.")
    return unique_data


def upload_to_supabase(data: list, drop_existing: bool = False):
    """
    Sorts new records by date and upserts them into the shared agmarknet_prices table.
    When drop_existing is True, the table is wiped first for an explicit full refresh.
    """
    if not data:
        print("\nNo valid records collected to upload.")
        return

    # 1. Deduplicate records locally
    clean_unique_data = deduplicate_records(data)

    # 2. Sort entries chronologically by arrival_date
    sorted_data = sorted(
        clean_unique_data,
        key=lambda x: x["arrival_date"] or ""
    )

    # 3. Optionally wipe existing rows for an explicit full refresh
    if drop_existing:
        clear_supabase_table()

    # 4. Upsert sorted batch using the shared-row conflict target
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"\nUpserting {len(sorted_data)} sorted entries to Supabase table 'agmarknet_prices'...")

    batch_size = 100
    conflict_target = "commodity,market,district,variety,grade,arrival_date"
    failed_batches = 0
    for i in range(0, len(sorted_data), batch_size):
        batch = sorted_data[i:i + batch_size]
        try:
            supabase.table("agmarknet_prices").upsert(
                batch,
                on_conflict=conflict_target
            ).execute()
            print(f"  Batch {i // batch_size + 1} upserted successfully.")
        except Exception as e:
            failed_batches += 1
            print(f"  Batch upsert error: {e}")

    if failed_batches:
        raise RuntimeError(
            f"{failed_batches} batch(es) failed. No successful completion can be reported. "
            "Create the required unique constraint for the on_conflict columns and rerun."
        )



if __name__ == "__main__":
    if not all([OGD_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
        raise ValueError("Check your .env file for missing variables.")

    commodity_names = get_all_commodity_names()
    if not commodity_names:
        raise ValueError("No commodity names were found in the Commodity catalog or agmarknet_prices table.")

    all_raw_records = []

    for commodity in commodity_names:
        print(f"\n=== Fetching commodity: {commodity} ===")
        raw_records = fetch_agmarknet_date_range(
            api_key=OGD_API_KEY,
            target_state="Maharashtra",
            target_commodities=[commodity],
            days_back=7,
            max_scan_cap_per_day=1000,
        )

        print(f"  -> Collected {len(raw_records)} raw records for {commodity}")
        all_raw_records.extend(raw_records)

    cleaned_data = transform_data(all_raw_records)

    # Preserve existing commodity rows; use drop_existing=True only for intentional full refreshes.
    upload_to_supabase(cleaned_data, drop_existing=False)

    print(f"\nIncremental upsert ingestion pipeline finished successfully for {len(commodity_names)} commodities.")