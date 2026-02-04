#!/usr/bin/env python3
"""
Map all "other" category transactions to their proper categories based on notes
"""

# Read the file
with open('cashflow-app/src/data/plan.ts', 'r') as f:
    content = f.read()

# Define mapping of notes patterns to correct categories
mappings = [
    # Giving-related
    ("Utility Sacrifices", "giving"),
    ("Mummy J and Mummy R", "giving"),  # Allowance/support for parents
    ("December contribution", "giving"),
    ("Tithe on McD", "giving"),
    ("Sacrifice for", "giving"),
    ("contribution", "giving"),
    ("Donation", "giving"),
    
    # Bill-related  
    ("One-Off Giving (Christmas)", "bill"),
    ("Monzo payment", "bill"),
    ("Laptop for December", "bill"),
    ("Rent for December", "bill"),
    ("Car insurance", "bill"),
    ("insurance", "bill"),
    ("Iphone payment", "bill"),
    ("Iphone", "bill"),
    ("iPhone", "bill"),
    ("Fuel for", "bill"),
    ("Fuel", "bill"),
    ("Road tax", "bill"),
    ("Community fibre", "bill"),
    ("SkyMobile", "bill"),
    ("Water", "bill"),
    ("Electricity", "bill"),
    ("Gas", "bill"),
    ("Credit Card", "bill"),
    ("Capital one", "bill"),
]

# Process each mapping
changes = 0
for pattern, new_category in mappings:
    # Find transactions with this pattern in notes and category "other"
    import re
    
    # Match pattern like: category: "other", notes: "..."
    # But we need to be careful to only change if the note contains this pattern
    
    # Use a more sophisticated approach - find the transactions and update them
    pattern_regex = f'(, notes: "[^"]*{re.escape(pattern)}[^"]*")'
    
    # Find all matches with category "other" before this notes field
    matches = list(re.finditer(f'category: "other"(.*?{re.escape(pattern)}[^"]*")', content, re.DOTALL))
    
    # This is getting complicated. Let's just do targeted replacements
    
# Actually, let's be more direct and replace based on exact note values
replacements = [
    ('category: "other", notes: "One-Off Giving (Christmas)"', 'category: "bill", notes: "One-Off Giving (Christmas)"'),
    ('category: "other", notes: "Utility sacrifice for December"', 'category: "giving", notes: "Utility sacrifice for December"'),
    ('category: "other", notes: "Allowance for December"', 'category: "bill", notes: "Allowance for December"'),  # Actually Mummy J is in FIXED
    ('category: "other", notes: "Monzo payment - Dec"', 'category: "bill", notes: "Monzo payment - Dec"'),
    ('category: "other", notes: "December contribution"', 'category: "giving", notes: "December contribution"'),
    ('category: "other", notes: "Gift for the Christmas Season"', 'category: "bill", notes: "Gift for the Christmas Season"'),  # Should be One-Off
    ('category: "other", notes: "Fuel for Renault Scenic"', 'category: "bill", notes: "Fuel for Renault Scenic"'),
    ('category: "other", notes: "last payment for iphone 13"', 'category: "bill", notes: "last payment for iphone 13"'),
    ('category: "other", notes: "Capital one for Dec"', 'category: "bill", notes: "Capital one for Dec"'),
    ('category: "other", notes: "Community fibre/ internet for December"', 'category: "bill", notes: "Community fibre/ internet for December"'),
    ('category: "other", notes: "Laptop for December"', 'category: "bill", notes: "Laptop for December"'),
    ('category: "other", notes: "Iphone payment"', 'category: "bill", notes: "Iphone payment"'),
    ('category: "other", notes: "Support for lisence"', 'category: "bill", notes: "Support for lisence"'),
    ('category: "other", notes: "Rent for December"', 'category: "bill", notes: "Rent for December"'),
    ('category: "other", notes: "SkyMobile"', 'category: "bill", notes: "SkyMobile"'),
    ('category: "other", notes: "EUI Ltd - insurance for the car"', 'category: "bill", notes: "EUI Ltd - insurance for the car"'),
    ('category: "other", notes: "Fuel to Georges Kablan for 31st Night"', 'category: "bill", notes: "Fuel to Georges Kablan for 31st Night"'),
    ('category: "other", notes: "on the 24/12 - Fuel"', 'category: "bill", notes: "on the 24/12 - Fuel"'),
    ('category: "other", notes: "Tithe on McD"', 'category: "giving", notes: "Tithe on McD"'),
    ('category: "other", notes: "Road tax for Dec"', 'category: "bill", notes: "Road tax for Dec"'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        changes += 1

print(f"Applied {changes} category updates")

# Verify final state
import re
giving_count = len(re.findall(r'category: "giving"', content))
bill_count = len(re.findall(r'category: "bill"', content))
allowance_count = len(re.findall(r'category: "allowance"', content))
other_count = len(re.findall(r'category: "other"', content))
income_count = len(re.findall(r'category: "income"', content))
savings_count = len(re.findall(r'category: "savings"', content))

print()
print("Final category distribution:")
print(f"  income:   {income_count}")
print(f"  bill:     {bill_count}")
print(f"  giving:   {giving_count}")
print(f"  allowance: {allowance_count}")
print(f"  savings:  {savings_count}")
print(f"  other:    {other_count} (should be 0)")

with open('cashflow-app/src/data/plan.ts', 'w') as f:
    f.write(content)

print("\n✓ File updated")
