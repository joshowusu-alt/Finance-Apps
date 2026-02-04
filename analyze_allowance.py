#!/usr/bin/env python3
"""
Break down what's in the "allowance" category
"""

import re

# Read plan.ts
with open('cashflow-app/src/data/plan.ts', 'r') as f:
    content = f.read()

# Extract transactions with allowance category
matches = re.findall(r'{ id: ("txn-\d+"), date: ("[\d-]+"), label: (".*?"), amount: ([\d.]+), type: ("(?:income|outflow|transfer)"), category: "allowance", notes: (".*?")(, linkedRuleId: )?', content)

print("ALLOWANCE TRANSACTIONS BREAKDOWN")
print("=" * 80)
print()

# Group by notes/type
by_type = {}
total = 0

for match in matches:
    txn_id, date, label, amount, txn_type, notes, _ = match
    amount = float(amount)
    notes_str = notes.strip('"')
    
    if notes_str not in by_type:
        by_type[notes_str] = {'count': 0, 'total': 0, 'examples': []}
    
    by_type[notes_str]['count'] += 1
    by_type[notes_str]['total'] += amount
    by_type[notes_str]['examples'].append(f"{date.strip('"')} - {label.strip('"')}: £{amount:.2f}")
    
    total += amount

# Sort by total amount
sorted_types = sorted(by_type.items(), key=lambda x: x[1]['total'], reverse=True)

for notes_str, data in sorted_types:
    print(f"{notes_str}")
    print(f"  Count: {data['count']} | Total: £{data['total']:.2f}")
    # Show first 2 examples
    for ex in data['examples'][:2]:
        print(f"    • {ex}")
    if len(data['examples']) > 2:
        print(f"    ... and {len(data['examples']) - 2} more")
    print()

print("=" * 80)
print(f"TOTAL ALLOWANCE: £{total:.2f}")
print()
print("Excel Budget by Period breakdown:")
print("  VARIABLE category = £300 budget")
print("    • Food: £150")
print("    • Others: £150")
print()
print("What we actually have in 'allowance':")
print("  • House Keep items (54 items) - NOW RECATEGORIZED TO 'BILL'")
print("  • Uber/Transport/Misc (remaining items)")
print()
