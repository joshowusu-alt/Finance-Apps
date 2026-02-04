import json
from collections import defaultdict

with open('period1_transactions_corrected.json') as f:
    txns = json.load(f)

# Get all unique allowance items
allowance_items = [t for t in txns if t['category'] == 'allowance']

print(f'Total allowance items: {len(allowance_items)}')
total_allowance = sum(t['amount'] for t in allowance_items)
print(f'Total allowance amount: £{total_allowance:.2f}')
print()
print('Breakdown by Excel category (notes field):')

by_excel_cat = defaultdict(list)
for t in allowance_items:
    by_excel_cat[t['notes']].append(t['amount'])

for excel_cat in sorted(by_excel_cat.keys()):
    amounts = by_excel_cat[excel_cat]
    total = sum(amounts)
    print(f'  {excel_cat:30} | Count: {len(amounts):2} | Total: £{total:>8,.2f}')

print()
print('All allowance transactions:')
for t in sorted(allowance_items, key=lambda x: x['date']):
    print(f"  {t['date']} | {t['label']:40} | £{t['amount']:>8.2f} | {t['notes']}")
