import os
import time
import requests
from urllib.parse import quote
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
            query_url = (
                f"{base_url}?api-key={api_key}&format=json"
                f"&limit={batch_limit}&offset={offset}"
                f"&filters%5BArrival_Date%5D={quote(target_date_str)}"
            )
            
            if target_state:
                query_url += f"&filters%5BState%5D={quote(target_state)}"

            response_json = None

            for attempt in range(1, 4):
                try:
                    res = requests.get(query_url, headers=headers, timeout=15)
                    if res.status_code == 200:
                        response_json = res.json()
                        break
                    elif res.status_code in [502, 503, 504]:
                        time.sleep(attempt * 2)
                except Exception:
                    time.sleep(attempt * 2)

            if not response_json:
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
                    comm_match = any(t.lower() in comm for t in target_commodities)

                # Match market condition
                market_match = True
                if target_markets:
                    market_match = any(m.lower() in market_name for m in target_markets)

                if comm_match and market_match:
                    all_records.append(r)
                    date_records_found += 1

            total_available = int(response_json.get("total", 0))
            offset += len(records)

            if offset >= total_available or offset >= max_scan_cap_per_day:
                break

            time.sleep(0.1)

        print(f"  -> Found {date_records_found} matching records for {target_date_str}")

    return all_records


def transform_data(raw_records: list) -> list:
    """Transforms raw records to fit schema."""
    clean_list = []
    for r in raw_records:
        state_v = r.get("state") or r.get("State")
        district_v = r.get("district") or r.get("District")
        market_v = r.get("market") or r.get("Market")
        commodity_v = r.get("commodity") or r.get("Commodity")
        variety_v = r.get("variety") or r.get("Variety")
        grade_v = r.get("grade") or r.get("Grade")
        date_v = r.get("arrival_date") or r.get("Arrival_Date")

        min_p = r.get("min_price") or r.get("Min_Price")
        max_p = r.get("max_price") or r.get("Max_Price")
        modal_p = r.get("modal_price") or r.get("Modal_Price")

        if not (market_v and commodity_v and variety_v and date_v):
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

    return clean_list


def deduplicate_records(data: list) -> list:
    """
    Removes duplicate records based on constraint key:
    (market, commodity, variety, arrival_date)
    """
    seen = set()
    unique_data = []

    for item in data:
        key = (
            item["market"],
            item["commodity"],
            item["variety"],
            item["arrival_date"]
        )
        if key not in seen:
            seen.add(key)
            unique_data.append(item)

    print(f"\nDeduplicated payload: {len(data)} total -> {len(unique_data)} unique records.")
    return unique_data


def upload_to_supabase(data: list, drop_existing: bool = True):
    """
    Optionally drops all existing table entries, sorts new records by date,
    and uploads them to Supabase.
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

    # 3. Wipe old entries if flag is True
    if drop_existing:
        clear_supabase_table()

    # 4. Upload sorted batch
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"\nUploading {len(sorted_data)} sorted entries to Supabase table 'agmarknet_prices'...")

    batch_size = 100
    for i in range(0, len(sorted_data), batch_size):
        batch = sorted_data[i:i + batch_size]
        try:
            supabase.table("agmarknet_prices").insert(batch).execute()
            print(f"  Batch {i // batch_size + 1} inserted successfully.")
        except Exception as e:
            print(f"  Batch insert error: {e}")



if __name__ == "__main__":
    if not all([OGD_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
        raise ValueError("Check your .env file for missing variables.")

    raw_data = fetch_agmarknet_date_range(
        api_key=OGD_API_KEY,
        target_state="Maharashtra",
        target_commodities=["masur", "lentil"],
        target_markets=["mumbai"],
        days_back=7
    )

    cleaned_data = transform_data(raw_data)
    
    # drop_existing=True clears old database entries first, then appends sorted rows
    upload_to_supabase(cleaned_data, drop_existing=True)
    
    print("\nWipe-and-replace ingestion pipeline finished successfully!")