import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

from location_api import geocode_place_with_fallbacks, value_from

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

HOST = os.getenv("WAREHOUSE_API_HOST", "127.0.0.1")
PORT = int(os.getenv("WAREHOUSE_API_PORT", "5002"))


def warehouse_name(row):
    return value_from(row, ["WH Name", "WH name", "name", "warehouse_name", "Warehouse Name"]) or "Warehouse"


def warehouse_place(row, district):
    parts = [
        warehouse_name(row),
        value_from(row, ["Address", "address", "WH Address"]),
        district,
        "Maharashtra",
        "India",
    ]
    return ", ".join(dict.fromkeys(str(part).strip() for part in parts if part and str(part).strip()))


def get_supabase_client():
    from supabase import create_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY (or VITE_SUPABASE_ANON_KEY) are required.")
    return create_client(url, key)


def fetch_warehouses(district):
    client = get_supabase_client()
    response = client.table("Warehouses").select("*").ilike("District", f"%{district}%").execute()
    return client, response.data or []


def resolve_warehouse_rows(district, apply_changes=False, limit=None):
    client, rows = fetch_warehouses(district)
    if limit is not None:
        rows = rows[:limit]

    print(f"Found {len(rows)} warehouse row(s) in district: {district}")
    updated = 0
    failed = 0
    for row in rows:
        row_id = value_from(row, ["id", "Id", "ID"])
        place = warehouse_place(row, district)
        result, matched_query = geocode_place_with_fallbacks(place)
        if not result:
            failed += 1
            print(f"  NOT FOUND {row_id}: {place}")
            continue

        print(f"  {row_id}: {warehouse_name(row)} -> {result['latitude']:.6f}, {result['longitude']:.6f}")
        if apply_changes:
            client.table("Warehouses").update({
                "Latitude": result["latitude"],
                "Longitude": result["longitude"],
            }).eq("id", row_id).execute()
            updated += 1

    mode = "updated" if apply_changes else "previewed"
    print(f"Finished: {mode} {updated if apply_changes else len(rows) - failed} row(s); {failed} failed.")
    if not apply_changes:
        print("No database changes were made. Add --apply to write coordinates.")


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class WarehouseHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/warehouses":
            json_response(self, 404, {"error": "Not found"})
            return

        district = parse_qs(parsed.query).get("district", [""])[0].strip()
        if not district:
            json_response(self, 400, {"error": "A district is required."})
            return
        if len(district) > 80:
            json_response(self, 400, {"error": "District is too long."})
            return

        try:
            _, rows = fetch_warehouses(district)
            warehouses = []
            for row in rows:
                result, matched_query = geocode_place_with_fallbacks(warehouse_place(row, district))
                if result:
                    warehouses.append({
                        "id": value_from(row, ["id", "Id", "ID"]),
                        "name": warehouse_name(row),
                        "district": district,
                        "latitude": result["latitude"],
                        "longitude": result["longitude"],
                        "matchedQuery": matched_query,
                    })
            json_response(self, 200, {"district": district, "warehouses": warehouses})
        except Exception as error:
            print(f"Warehouse lookup failed: {error}")
            json_response(self, 502, {"error": "The warehouse lookup is unavailable."})

    def log_message(self, format_string, *args):
        print(f"[warehouse-api] {self.address_string()} - {format_string % args}")


def parse_arguments():
    parser = argparse.ArgumentParser(description="AgriTrade warehouse coordinate API")
    parser.add_argument("--district", help="Fetch warehouses from this district")
    parser.add_argument("--apply", action="store_true", help="Write fetched coordinates to public.Warehouses")
    parser.add_argument("--limit", type=int, help="Process at most this many warehouses")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_arguments()
    if arguments.district:
        resolve_warehouse_rows(arguments.district, arguments.apply, arguments.limit)
    else:
        server = ThreadingHTTPServer((HOST, PORT), WarehouseHandler)
        print(f"Warehouse API listening on http://{HOST}:{PORT}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping warehouse API")
        finally:
            server.server_close()
