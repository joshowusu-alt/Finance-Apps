import openpyxl
import json
from datetime import datetime

excel_file = "FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx"
wb = openpyxl.load_workbook(excel_file, data_only=True)

# Complete mapping with handling for trailing spaces
category_to_app = {
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
    'Tithe': 'giving',
    'Tithe ': 'giving',  # With trailing space
    'Offerings': 'giving',
    'Charity - Perez Uni': 'giving',
    'Charity - JPC Utilities': 'giving',
    'Donations (Variable)': 'giving',
    'House Keep': 'allowance',
    'Others': 'allowance',
    'Uber - TfL': 'allowance',
    'One-Off Giving (Christmas)': 'other',
    'Savings Transfer': 'savings',
}

# Extract transactions
transactions = []
app_category_totals = {'income': 0, 'bill': 0, 'giving': 0, 'allowance': 0, 'savings': 0, 'other': 0}

ws_txn = wb['Transactions']

for i, row in enumerate(ws_txn.iter_rows(min_row=2, max_row=1200, values_only=True), 2):
    date = row[0]
    txn_type = row[1]
    category = row[2]
    description = row[3]
    amount = row[4]
    period = row[8]
    
    if period != 1 or not date or not amount:
        continue
    
    if isinstance(date, datetime):
        date_str = date.strftime('%Y-%m-%d')
    else:
        continue
    
    category_str = str(category) if category else ''
    
    if txn_type == 'Income':
        final_type = 'income'
        app_cat = 'income'
    elif txn_type == 'Transfer':
        final_type = 'transfer'
        app_cat = 'savings'
    else:
        final_type = 'outflow'
        app_cat = category_to_app.get(category_str, 'other')
    
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
    
    if app_cat == 'income':
        app_category_totals['income'] += abs(float(amount))
    elif final_type == 'transfer':
        app_category_totals['savings'] += abs(float(amount))
    else:
        app_category_totals[app_cat] += abs(float(amount))

# Sort by date descending
transactions.sort(key=lambda x: x['date'], reverse=True)

# Save
output_file = 'period1_transactions_final.json'
with open(output_file, 'w') as f:
    json.dump(transactions, f, indent=2)

print(f"✓ Extracted {len(transactions)} transactions")
print(f"\nBreakdown:")
print(f"  Income:    £{app_category_totals['income']:8.2f}")
print(f"  Bills:     £{app_category_totals['bill']:8.2f}")
print(f"  Giving:    £{app_category_totals['giving']:8.2f}")
print(f"  Allowance: £{app_category_totals['allowance']:8.2f}")
print(f"  Savings:   £{app_category_totals['savings']:8.2f}")
print(f"  Other:     £{app_category_totals['other']:8.2f}")

total_expenses = sum([app_category_totals[k] for k in ['bill', 'giving', 'allowance', 'savings', 'other']])
print(f"\nTotal Expenses: £{total_expenses:.2f}")
print(f"Net: £{app_category_totals['income'] - total_expenses:.2f}")

# Print corrected budgets
print(f"\n" + "="*80)
print("CORRECTED OUTFLOW RULES FOR plan.ts:")
print("="*80)

outflow_rules_correct = [
    ('giving', 815, 'Giving'),
    ('savings', 1050, 'Savings transfer'),
    ('allowance', 300, 'Weekly allowance'),
]

print("\noutflowRules should be:")
for rule_id, amount, label in outflow_rules_correct:
    print(f'  id: "{rule_id}", amount: {amount}, label: "{label}"')

# Print corrected bills for plan.ts  
bills_correct = [
    ('rent', 'Rent', 550),
    ('insurance', 'Insurance', 175),
    ('road-tax', 'Road Tax', 34),
    ('water', 'Water Bill', 93),
    ('electricity-gas', 'Electricity & Gas', 200),
    ('internet', 'Community Fibre / Internet', 37),
    ('iphone', 'iPhone Payments', 108),
    ('parents', 'Parents', 140),
    ('credit-card', 'Credit Card Payment', 400),
    ('fuel', 'Fuel', 100),
    ('house-keep', 'House Keep', 560),
    ('laptop', 'Laptop', 43),
    ('christmas', 'One-Off Giving (Christmas)', 500),
]

print("\nBills should include:")
for bill_id, label, amount in bills_correct:
    print(f'  id: "{bill_id}", label: "{label}", amount: {amount}')

