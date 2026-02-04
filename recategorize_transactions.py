#!/usr/bin/env python3
"""
Re-categorize transactions based on updated bills and Excel structure.
House Keep and One-Off should now be 'bill' not 'allowance'/'other'.
Donations should be 'giving'.
"""

import json

# Read current transactions from plan
with open('cashflow-app/src/data/plan.ts', 'r') as f:
    content = f.read()

# Extract the transactions array
import re
trans_match = re.search(r'transactions: \[(.*?)\n  \],', content, re.DOTALL)
if not trans_match:
    print("Could not find transactions array")
    exit(1)

# Simple regex extraction - this is hacky but works for our format
trans_section = trans_match.group(1)

# Parse each transaction line
transactions = []
for line in trans_section.strip().split('\n'):
    if 'id: "txn-' in line:
        # Extract the full transaction object
        match = re.search(r'\{ (id: .*?) \},?$', line)
        if match:
            obj_str = "{" + match.group(1) + "}"
            # Evaluate as JavaScript-like object
            # Convert to Python dict notation
            obj_str = obj_str.replace(': "', ': "').replace('", category:', '", "category":').replace('notes:', '"notes":').replace('linkedRuleId:', '"linkedRuleId":')
            obj_str = obj_str.replace('undefined', 'null')
            obj_str = obj_str.replace(' type:', ' "type":').replace(' amount:', ' "amount":').replace(' date:', ' "date":').replace(' label:', ' "label":').replace(' id:', ' "id":')
            try:
                obj = eval(obj_str.replace("'", '"'))
            except:
                pass

print("This approach is too complex. Let me use the extracted JSON from before and re-categorize it...")

# Actually, let's use the categorization mapping from Excel
categorization_map = {
    # Current "allowance" items that should be "bill"  
    "House Keep": "bill",
    
    # Current "other" items that should be "bill"
    "One-Off Giving (Christmas)": "bill",
    
    # Items that should stay as "giving" (check for "Donations")
    "Donations": "giving",
    "Donations (Variable)": "giving",
}

print("Category remapping:")
for item, category in categorization_map.items():
    print(f"  {item} -> {category}")
