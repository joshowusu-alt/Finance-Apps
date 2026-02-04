import openpyxl
import json
from datetime import datetime
from collections import defaultdict

excel_file = "FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx"
wb = openpyxl.load_workbook(excel_file, data_only=True)

# Complete mapping based on Bills Schedule and Budget by Period
category_to_app = {
    # FIXED/Bills
    'Rent': 'bill',
    'Insurance': 'bill',
    'Road Tax': 'bill',
    'Water Bill': 'bill',
    'Electricity & Gas': 'bill',
    'Community Fibre / Internet': 'bill',
    'iPhone Payments': 'bill',
    'Parents': 'bill',
    'Credit Card Payment': 'bill',
    'Fuel': 'bill',
    'Laptop': 'bill',
    
    # GIVING
    'Tithe': 'giving',
    'Offerings': 'giving',
    'Charity - Perez Uni': 'giving',
    'Charity - JPC Utilities': 'giving',
    'Donations (Variable)': 'giving',
    
    # VARIABLE (Food + Others)
    'House Keep': 'allowance',
    'Others': 'allowance',
    'Uber - TfL': 'allowance',
    
    # One-off
    'One-Off Giving (Christmas)': 'other',
    
    # Savings
    'Savings Transfer': 'savings',
}

# Extract transactions
transactions = []
app_category_totals = defaultdict(lambda: {'count': 0, 'amount': 0})
unmapped = defaultdict(lambda: {'count': 0, 'amount': 0})

ws_txn = wb['Transactions']

for i, row in enumerate(ws_txn.iter_rows(min_row=2, max_row=1200, values_only=True), 2):
    date = row[0]
    txn_type = row[1]
    category = row[2]
    description = row[3]
    amount = row[4]
    period = row[8]  # Column I
    
    if period != 1 or not date or not amount:
        continue
    
    # Parse date
    if isinstance(date, datetime):
        date_str = date.strftime('%Y-%m-%d')
    else:
        continue
    
    # Determine transaction type and app category
    category_str = str(category) if category else ''
    
    if txn_type == 'Income':
        final_type = 'income'
        app_cat = 'income'
    elif txn_type == 'Transfer':
        final_type = 'transfer'
        app_cat = 'savings'
    else:  # Expense
        final_type = 'outflow'
        # Map using category column
        if category_str in category_to_app:
            app_cat = category_to_app[category_str]
        else:
            app_cat = 'other'
            unmapped[category_str]['count'] += 1
            unmapped[category_str]['amount'] += abs(float(amount))
    
    label = str(description or category or '')
    
    transactions.append({
        'id': f"txn-{len(transactions)+1}",
        'date': date_str,
        'label': label,
        'amount': abs(float(amount)),
        'type': final_type,
        'category': app_cat,
        'notes': category_str,
        'linkedRuleId': 'savings' if app_cat == 'savings' else None
    })
    
    app_category_totals[app_cat]['count'] += 1
    app_category_totals[app_cat]['amount'] += abs(float(amount))

# Sort by date descending
transactions.sort(key=lambda x: x['date'], reverse=True)

print("="*100)
print(f"EXTRACTED {len(transactions)} PERIOD 1 TRANSACTIONS")
print("="*100)

print("\nApp Category Totals:")
for cat in ['income', 'bill', 'giving', 'allowance', 'savings', 'other']:
    if cat in app_category_totals:
        data = app_category_totals[cat]
        print(f"  {cat:12} Count: {data['count']:3}  Amount: £{data['amount']:8.2f}")

total_outflow = (app_category_totals.get('bill', {'amount': 0})['amount'] +
                app_category_totals.get('giving', {'amount': 0})['amount'] +
                app_category_totals.get('allowance', {'amount': 0})['amount'] +
                app_category_totals.get('savings', {'amount': 0})['amount'] +
                app_category_totals.get('other', {'amount': 0})['amount'])

print(f"\n  INCOME         £{app_category_totals['income']['amount']:8.2f}")
print(f"  EXPENSES       £{total_outflow:8.2f}")
print(f"  NET            £{app_category_totals['income']['amount'] - total_outflow:8.2f}")

if unmapped:
    print(f"\n\nUnmapped items ({len(unmapped)}):")
    for cat in sorted(unmapped.keys()):
        data = unmapped[cat]
        print(f"  '{cat}' - Count: {data['count']}, Amount: £{data['amount']:.2f}")

# Save to JSON
output_file = 'period1_transactions_final.json'
with open(output_file, 'w') as f:
    json.dump(transactions, f, indent=2)

print(f"\n✓ Saved to {output_file}")

# Print first 10 for verification
print("\nFirst 10 transactions (newest first):")
for i, txn in enumerate(transactions[:10], 1):
    print(f"  {i}. {txn['date']} {txn['label']:40} {txn['type']:8} {txn['category']:10} £{txn['amount']:8.2f}")

