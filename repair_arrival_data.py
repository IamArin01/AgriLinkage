import os
import subprocess
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
PYTHON_EXE = r"c:\Users\arinm\Downloads\AgriTrade\New\AgriTrade\.venv\Scripts\python.exe"
PROJECT_ROOT = r"c:\Users\arinm\Downloads\AgriTrade\New\AgriTrade"


def is_empty(value):
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
rows = (supabase.table('agmarknet_arrival').select('*').execute().data) or []
empty_ids = []
for row in rows:
    quantity_value = (
        row.get('arrival quantity')
        or row.get('arrival_quantity')
        or row.get('Arrival_Quantity')
        or row.get('Arrival Quantity')
        or row.get('arrival_qty')
        or row.get('Arrival_Qty')
    )
    if is_empty(quantity_value):
        empty_ids.append(row['id'])

print(f'Found {len(empty_ids)} rows with empty arrival quantity.')
if empty_ids:
    supabase.table('agmarknet_arrival').delete().in_('id', empty_ids).execute()
    print('Deleted empty-arrival rows.')

subprocess.run([PYTHON_EXE, 'arrival_api.py'], cwd=PROJECT_ROOT, check=True)

sample_rows = (supabase.table('agmarknet_arrival').select('*').limit(5).execute().data) or []
print('Sample rows after refresh:')
for row in sample_rows:
    print(row)
