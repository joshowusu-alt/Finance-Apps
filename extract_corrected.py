import openpyxl
import json
from datetime import datetime

excel_file = "FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx"
wb = openpyxl.load_workbook(excel_file, data_only=True)

# First, map Excel items to correct app categories using Bills Schedule as reference
bills_schedule_map = {
    # FIXED/Bills items
    'Rent': 'bill',
    'Insurance': 'bill',
    'Road Tax': 'bill',
    'Water Bill': 'bill',
    'Community Fibre / Internet': 'bill',
    'Electricity & Gas': 'bill',
    'Electricity': 'bill',
    'Gas': 'bill',
    'Gas for house': 'bill',
    'iPhone Payments': 'bill',
    'SkyMobile': 'bill',
    'Car insurance': 'bill',
    'Car Insurance': 'bill',
    
    # GIVING items
    'Tithe': 'giving',
    'FM Tithe': 'giving',
    'Offerings': 'giving',
    'Burnt offering': 'giving',
    'Burned offering': 'giving',
    'Thanksgiving Offering': 'giving',
    'Charity - Perez Uni': 'giving',
    'Charity - JPC Utilities': 'giving',
    'Gifts': 'giving',
    'Gift from Honey': 'giving',
    'Gift to': 'giving',
    'Donations (Variable)': 'giving',
    
    # FIXED items (non-bills)
    'Parents': 'bill',
    'Credit Card Payment': 'bill',
    'Fuel': 'bill',
    'House Keep': 'allowance',
    'Laptop': 'bill',
    'One-Off Giving (Christmas)': 'other',
    
    # VARIABLE items
    'Food': 'allowance',
    'Groceries': 'allowance',
    'Sainsbury\'s': 'allowance',
    'Tesco': 'allowance',
    'Costco': 'allowance',
    'Holland bazaar': 'allowance',
    'Fish Market': 'allowance',
    'Halal': 'allowance',
    'Deliveroo': 'allowance',
    'Uber eats': 'allowance',
    'KFC': 'allowance',
    'Boba': 'allowance',
    'Fried rice': 'allowance',
    'Chinese fried rice': 'allowance',
    'Kenkey': 'allowance',
    'Tuna': 'allowance',
    'TfL': 'allowance',
    'Transport': 'allowance',
    'Uber': 'allowance',
    'Uber to': 'allowance',
    'Bolt': 'allowance',
    'Subscriptions': 'allowance',
    'Battery': 'allowance',
    'Wipes': 'allowance',
    'Cerelac': 'allowance',
    'Body wash': 'allowance',
    'Water': 'allowance',
    'Lebara': 'allowance',
    'KitKatt': 'allowance',
    'OpenAI': 'allowance',
    'Monzo payment': 'other',
    'Capital one': 'other',
    'Barclays': 'other',
    'Internet': 'bill',
    'Community fibre': 'bill',
    'Sacrifice': 'other',
    'Utility': 'other',
    'Mummy': 'other',
    'Gift': 'other',
    'Rent for': 'bill',
    'Monzo': 'other',
    'Stocks and Shares': 'savings',
    'Money Box': 'savings',
    'Transfer to': 'savings',
    'Towing': 'allowance',
    'Fixing': 'allowance',
    'Post office': 'allowance',
    'Fuel for': 'allowance',
    'Hosting': 'allowance',
    'Ingredients': 'allowance',
    'Cake': 'allowance',
}

def map_category(label, category_from_excel):
    """Map transaction label to correct app category"""
    label_lower = label.lower()
    
    # Check exact word matches first
    for key, cat in bills_schedule_map.items():
        if key.lower() in label_lower:
            return cat
    
    # Fallback to Excel category with mappings
    excel_cat_map = {
        'income': 'income',
        'Income - FM': 'income',
        'Income - McD': 'income',
        'Income - Outlier': 'income',
        'Income - Gifts': 'income',
        'Outlier': 'income',
        'December Salary': 'income',
        'Interest': 'income',
    }
    
    for key, cat in excel_cat_map.items():
        if key.lower() in label_lower:
            return cat
    
    # If it's marked as expense in Excel but we don't know the category
    if category_from_excel:
        return category_from_excel
    
    return 'other'

# Read transactions from Transactions sheet
ws_txn = wb['Transactions']

transactions = []
for i, row in enumerate(ws_txn.iter_rows(min_row=2, max_row=1200, values_only=True), 1):
    date = row[0]
    type_val = row[1]
    category = row[2]
    description = row[3]
    amount = row[4]
    period = row[8]  # Column I
    
    if not all([date, type_val, amount, period]) or period != 1:
        continue
    
    # Parse date
    if isinstance(date, datetime):
        date_str = date.strftime('%Y-%m-%d')
    else:
        continue
    
    # Determine type
    if 'Transfer' in str(type_val):
        txn_type = 'transfer'
        app_cat = 'savings'
    elif type_val == 'Income' or 'Income' in str(category):
        txn_type = 'income'
        app_cat = 'income'
    else:
        txn_type = 'outflow'
        app_cat = map_category(str(description or category or ''), category)
    
    # Create transaction
    label = str(description or category or '')
    
    transactions.append({
        'id': f"txn-{len(transactions)+1}",
        'date': date_str,
        'label': label,
        'amount': abs(float(amount)),
        'type': txn_type,
        'category': app_cat,
        'notes': category,
        'linkedRuleId': 'savings' if app_cat == 'savings' else None
    })

# Sort by date descending (newest first)
transactions.sort(key=lambda x: x['date'], reverse=True)

# Print summary
print("="*100)
print(f"EXTRACTED {len(transactions)} Period 1 TRANSACTIONS")
print("="*100)

# Group by category
from collections import defaultdict
by_cat = defaultdict(list)
by_type = defaultdict(lambda: {'count': 0, 'amount': 0})

for txn in transactions:
    by_cat[txn['category']].append(txn)
    by_type[txn['type']]['count'] += 1
    by_type[txn['type']]['amount'] += txn['amount']

print("\nBy Category:")
for cat in ['income', 'bill', 'giving', 'allowance', 'savings', 'other']:
    if cat in by_cat:
        items = by_cat[cat]
        total = sum(t['amount'] for t in items)
        print(f"  {cat:12} {len(items):3} items  £{total:8.2f}")

print("\nBy Type:")
for typ in ['income', 'outflow', 'transfer']:
    if typ in by_type:
        print(f"  {typ:12} {by_type[typ]['count']:3} items  £{by_type[typ]['amount']:8.2f}")

# Save to JSON
output_file = 'period1_transactions_corrected.json'
with open(output_file, 'w') as f:
    json.dump(transactions, f, indent=2)

print(f"\nSaved to {output_file}")

# Print first 10 transactions for verification
print("\nFirst 10 transactions (newest first):")
for i, txn in enumerate(transactions[:10], 1):
    print(f"{i}. {txn['date']} {txn['label']:40} {txn['type']:8} {txn['category']:10} £{txn['amount']:8.2f}")

