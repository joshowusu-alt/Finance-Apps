#!/usr/bin/env python3
"""
Update transactions in plan.ts to recategorize based on notes field
"""

# Read the file
with open('cashflow-app/src/data/plan.ts', 'r') as f:
    content = f.read()

# Count before
import re
allowance_count = len(re.findall(r'category: "allowance"', content))
bill_count = len(re.findall(r'category: "bill"', content))
other_count = len(re.findall(r'category: "other"', content))
giving_count = len(re.findall(r'category: "giving"', content))

print(f"BEFORE:")
print(f"  allowance: {allowance_count}")
print(f"  bill: {bill_count}")
print(f"  other: {other_count}")
print(f"  giving: {giving_count}")
print()

# Replacements for transactions with House Keep notes (allowance -> bill)
content = content.replace(
    'category: "allowance", notes: "House Keep"',
    'category: "bill", notes: "House Keep"'
)

# Count House Keep bills before this change
house_keep_trans = len(re.findall(r'notes: "House Keep"', content))
print(f"House Keep transactions to recategorize: {house_keep_trans} (should all be bill)")

# Replacements for "One-Off Giving" and related (other -> bill)
# Search for any "One-Off" references in transactions
one_off_patterns = [
    ('category: "other", notes: "One-Off Giving"', 'category: "bill", notes: "One-Off Giving"'),
    # Also check for Christmas gift items
]

for old, new in one_off_patterns:
    count = content.count(old)
    if count > 0:
        print(f"Replacing {count} occurrences of: {old[:50]}...")
        content = content.replace(old, new)

# Check for Donations - these might be labeled something else in transactions
# Looking for transaction notes that map to "Donations (Variable)"
# From Excel, Donations appear as a category in GIVING

# Count after
allowance_count_after = len(re.findall(r'category: "allowance"', content))
bill_count_after = len(re.findall(r'category: "bill"', content))
other_count_after = len(re.findall(r'category: "other"', content))
giving_count_after = len(re.findall(r'category: "giving"', content))

print()
print(f"AFTER:")
print(f"  allowance: {allowance_count_after} (was {allowance_count}, changed: {allowance_count - allowance_count_after})")
print(f"  bill: {bill_count_after} (was {bill_count}, changed: {bill_count_after - bill_count})")
print(f"  other: {other_count_after} (was {other_count}, changed: {other_count - other_count_after})")
print(f"  giving: {giving_count_after} (was {giving_count}, changed: {giving_count_after - giving_count})")
print()

# Write back
with open('cashflow-app/src/data/plan.ts', 'w') as f:
    f.write(content)

print("✓ Transactions recategorized and file updated")
