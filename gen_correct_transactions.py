import openpyxl
from datetime import datetime
import json

# Load with data_only to get actual values
wb_values = openpyxl.load_workbook('FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx', data_only=True)
txn_sheet = wb_values['Transactions']

# Map Column C categories to app categories
category_mapping = {
    'Income - FM': 'income',
    'Income - McD': 'income',
    'Income - Outlier': 'income',
    'Income - Gifts': 'income',
    'House Keep': 'bill',
    'Electricity & Gas': 'bill',
    'Water Bill': 'bill',
    'Rent': 'bill',
    'Insurance': 'bill',
    'Road Tax': 'bill',
    'Community Fibre / Internet': 'bill',
    'Internet': 'bill',
    'iPhone Payments': 'bill',
    'Parents': 'bill',
    'Credit Card Payment': 'bill',
    'Fuel': 'bill',
    'Laptop': 'bill',
    'One-Off Giving (Christmas)': 'bill',
    'Tithe': 'giving',
    'Offerings': 'giving',
    'Charity - Perez Uni': 'giving',
    'Charity - JPC Utilities': 'giving',
    'Donations (Variable)': 'giving',
    'Others': 'allowance',
    'Uber - TfL': 'allowance',
    'Food': 'bill',
    'Savings Transfer': 'savings',
}

period1_start = datetime(2025, 12, 22)
period1_end = datetime(2026, 1, 25)

# Extract all Period 1 transactions
transactions = []
category_distribution = {}

print("Extracting Period 1 transactions...")
print()

for row_num in range(2, txn_sheet.max_row + 1):
    date_val = txn_sheet[f'A{row_num}'].value
    
    if date_val and isinstance(date_val, datetime):
        if period1_start <= date_val <= period1_end:
            col_b_type = txn_sheet[f'B{row_num}'].value
            col_c_category = txn_sheet[f'C{row_num}'].value
            col_d_desc = txn_sheet[f'D{row_num}'].value
            col_e_amount = txn_sheet[f'E{row_num}'].value
            
            # Map to app category
            app_category = category_mapping.get(col_c_category, 'other')
            
            # Determine type
            if col_b_type and 'income' in col_b_type.lower():
                tx_type = 'income'
            elif col_b_type and 'transfer' in col_d_desc.lower():
                tx_type = 'transfer'
            else:
                tx_type = 'outflow'
            
            txn = {
                'date': date_val.strftime('%Y-%m-%d'),
                'label': col_d_desc or '',
                'amount': float(col_e_amount) if col_e_amount else 0,
                'type': tx_type,
                'category': app_category,
                'notes': col_c_category,
                'col_c_category': col_c_category
            }
            
            transactions.append(txn)
            
            # Track distribution
            if app_category not in category_distribution:
                category_distribution[app_category] = 0
            category_distribution[app_category] += 1

# Sort by date
transactions = sorted(transactions, key=lambda x: x['date'])

# Display summary
print(f"Total transactions extracted: {len(transactions)}")
print()
print("Distribution by App Category:")
for cat in sorted(category_distribution.keys()):
    print(f"  {cat:15s}: {category_distribution[cat]:3d}")

print()
print("Distribution by Column C Category:")
col_c_dist = {}
for txn in transactions:
    col_c_cat = txn['col_c_category']
    if col_c_cat not in col_c_dist:
        col_c_dist[col_c_cat] = 0
    col_c_dist[col_c_cat] += 1

for cat in sorted(col_c_dist.keys()):
    print(f"  {cat:35s}: {col_c_dist[cat]:3d}")

# Save transactions
with open('period1_correct_transactions.json', 'w') as f:
    json.dump(transactions, f, indent=2)

print()
print("Saved to period1_correct_transactions.json")

# Generate TypeScript format
print()
print("Generating TypeScript format...")

ts_lines = []
for i, txn in enumerate(transactions, 1):
    ts_line = f'{{ id: "txn-{i}", date: "{txn["date"]}", label: "{txn["label"]}", amount: {txn["amount"]}, type: "{txn["type"]}", category: "{txn["category"]}", notes: "{txn["notes"]}", linkedRuleId: undefined }},'
    ts_lines.append(ts_line)

with open('period1_transactions.ts', 'w') as f:
    f.write('\n'.join(ts_lines))

print(f"Generated {len(ts_lines)} transaction lines in period1_transactions.ts")
