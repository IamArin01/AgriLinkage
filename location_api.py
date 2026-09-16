import argparse
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

HOST = os.getenv("LOCATION_API_HOST", "127.0.0.1")
PORT = int(os.getenv("LOCATION_API_PORT", "5001"))
GEOCODER_URL = os.getenv("GEOCODER_URL", "https://nominatim.openstreetmap.org/search")
USER_AGENT = os.getenv("GEOCODER_USER_AGENT", "AgriTrade/1.0 location service")
MIN_REQUEST_INTERVAL = 1.0
_cache = {}
_last_request_at = 0.0


def find_column(row, candidates):
    columns = {str(key).casefold(): key for key in row}
    for candidate in candidates:
        if candidate.casefold() in columns:
            return columns[candidate.casefold()]
    return None


def value_from(row, candidates):
    column = find_column(row, candidates)
    return row.get(column) if column else None


def build_mandi_place(row):
    parts = [
        value_from(row, ["Name", "name", "Mandi Name", "mandi_name"]),
        value_from(row, ["Location", "location", "City", "city", "Address", "address"]),
        value_from(row, ["District", "district"]),
        "Maharashtra",
        "India",
    ]
    return ", ".join(dict.fromkeys(str(part).strip() for part in parts if part and str(part).strip()))


def build_warehouse_place(row):
    parts = [
        value_from(row, ["WH Name", "WH name", "name", "warehouse_name", "Warehouse Name"]),
        value_from(row, ["Address", "address", "WH Address"]),
        value_from(row, ["District", "district"]),
        "Maharashtra",
        "India",
    ]
    return ", ".join(dict.fromkeys(str(part).strip() for part in parts if part and str(part).strip()))


def sync_coordinate_table(table_name, place_builder, apply_changes=False, limit=None, refresh=False, name_filter=None):
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY (or VITE_SUPABASE_ANON_KEY) are required.")

    client = create_client(supabase_url, supabase_key)
    response = client.table(table_name).select("*").execute()
    rows = response.data or []
    if not rows:
        print(f"No rows found in public.{table_name}.")
        return

    sample = rows[0]
    id_column = find_column(sample, ["id", "Id", "ID"])
    latitude_column = find_column(sample, ["latitude", "Latitude", "lat"])
    longitude_column = find_column(sample, ["longitude", "Longitude", "long", "lng"])
    if not id_column:
        raise RuntimeError(f"public.{table_name} needs an id column so rows can be updated.")
    if not latitude_column or not longitude_column:
        raise RuntimeError(f"public.{table_name} needs latitude/longitude or lat/long columns before syncing.")

    candidates = rows if refresh else [
        row for row in rows
        if row.get(latitude_column) in (None, "") or row.get(longitude_column) in (None, "")
    ]
    if name_filter:
        normalized_filter = name_filter.casefold().strip()
        candidates = [
            row for row in candidates
            if normalized_filter in str(value_from(row, ["Name", "name", "Mandi Name", "mandi_name"]) or "").casefold()
        ]
    if limit is not None:
        candidates = candidates[:limit]

    if not candidates:
        print(f"No {table_name} rows need coordinates.")
        return

    print(f"Preparing coordinates for {len(candidates)} {table_name} row(s).")
    updated_count = 0
    failed_count = 0
    for row in candidates:
        row_id = row.get(id_column)
        place = place_builder(row)
        try:
            result, matched_query = geocode_place_with_fallbacks(place)
        except Exception as error:
            result = None
            print(f"  ERROR {row_id}: {place} ({error})")

        if not result:
            failed_count += 1
            print(f"  NOT FOUND {row_id}: {place}")
            continue

        values = f"{result['latitude']:.6f}, {result['longitude']:.6f}"
        query_note = f" (matched: {matched_query})" if matched_query != place else ""
        print(f"  {row_id}: {place} -> {values}{query_note}")
        if apply_changes:
            client.table(table_name).update({
                latitude_column: result["latitude"],
                longitude_column: result["longitude"],
            }).eq(id_column, row_id).execute()
            updated_count += 1

    mode = "updated" if apply_changes else "previewed"
    print(f"Finished: {mode} {updated_count if apply_changes else len(candidates) - failed_count} row(s); {failed_count} failed.")
    if not apply_changes:
        print("No database changes were made. Add --apply to write these coordinates.")


def sync_mandi_table(apply_changes=False, limit=None, refresh=False, name_filter=None):
    sync_coordinate_table("Mandi", build_mandi_place, apply_changes, limit, refresh, name_filter)


def sync_warehouse_table(apply_changes=False, limit=None, refresh=False, name_filter=None):
    sync_coordinate_table("Warehouses", build_warehouse_place, apply_changes, limit, refresh, name_filter)


def parse_arguments():
    parser = argparse.ArgumentParser(description="AgriTrade geocoding API and Mandi coordinate utility")
    parser.add_argument("--place", help="Print coordinates for one place and exit")
    parser.add_argument("--sync-mandi", action="store_true", help="Geocode rows in public.Mandi")
    parser.add_argument("--sync-warehouses", action="store_true", help="Geocode rows in public.Warehouses")
    parser.add_argument("--apply", action="store_true", help="Write synced coordinates to the selected table")
    parser.add_argument("--refresh", action="store_true", help="Re-geocode rows that already have coordinates")
    parser.add_argument("--limit", type=int, help="Process at most this many Mandi rows")
    parser.add_argument("--name", help="Only process Mandi rows whose name contains this text")
    return parser.parse_args()


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def geocode_place(place):
    global _last_request_at

    normalized_place = " ".join(place.split())
    if "amaravati" in normalized_place.casefold() and "maharashtra" in normalized_place.casefold():
        normalized_place = normalized_place.replace("Amaravati", "Amravati").replace("amaravati", "Amravati")
    cache_key = normalized_place.casefold()
    if cache_key in _cache:
        return _cache[cache_key]

    wait_for = MIN_REQUEST_INTERVAL - (time.monotonic() - _last_request_at)
    if wait_for > 0:
        time.sleep(wait_for)

    query = f"{GEOCODER_URL}?q={quote(normalized_place)}&format=jsonv2&addressdetails=1&limit=1"
    request = Request(
        query,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=10) as response:
        results = json.load(response)
    _last_request_at = time.monotonic()

    if not results:
        return None

    result = results[0]
    address = result.get("address") or {}
    resolved = {
        "place": result.get("display_name") or normalized_place,
        "city": address.get("city") or address.get("town") or address.get("village") or address.get("municipality") or "",
        "district": address.get("county") or address.get("state_district") or "",
        "state": address.get("state") or "",
        "country": address.get("country") or "",
        "latitude": float(result["lat"]),
        "longitude": float(result["lon"]),
    }
    _cache[cache_key] = resolved
    return resolved


def geocode_place_with_fallbacks(place):
    queries = [place]
    parts = [part.strip() for part in place.split(",") if part.strip()]
    if len(parts) >= 4:
        queries.append(", ".join([parts[0], parts[-3], parts[-2], parts[-1]]))
        queries.append(", ".join(parts[-3:]))

    for query in dict.fromkeys(queries):
        result = geocode_place(query)
        if result:
            return result, query
    return None, place


class LocationHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path != "/api/geocode":
            json_response(self, 404, {"error": "Not found"})
            return

        place = parse_qs(parsed_url.query).get("place", [""])[0].strip()
        if not place:
            json_response(self, 400, {"error": "A place name is required."})
            return
        if len(place) > 120:
            json_response(self, 400, {"error": "Place name is too long."})
            return

        try:
            result = geocode_place(place)
        except Exception as error:
            print(f"Geocoding request failed: {error}")
            json_response(self, 502, {"error": "The geocoding provider is unavailable."})
            return

        if result is None:
            json_response(self, 404, {"error": "No location was found for that place."})
            return

        json_response(self, 200, result)

    def log_message(self, format_string, *args):
        print(f"[location-api] {self.address_string()} - {format_string % args}")


if __name__ == "__main__":
    arguments = parse_arguments()

    try:
        if arguments.place:
            result = geocode_place(arguments.place)
            if not result:
                print(f"No location found for: {arguments.place}")
                sys.exit(1)
            print(json.dumps(result, indent=2))
        elif arguments.sync_mandi or arguments.sync_warehouses:
            sync_function = sync_mandi_table if arguments.sync_mandi else sync_warehouse_table
            sync_function(
                apply_changes=arguments.apply,
                limit=arguments.limit,
                refresh=arguments.refresh,
                name_filter=arguments.name,
            )
        else:
            server = ThreadingHTTPServer((HOST, PORT), LocationHandler)
            print(f"Location API listening on http://{HOST}:{PORT}")
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                print("\nStopping location API")
            finally:
                server.server_close()
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
