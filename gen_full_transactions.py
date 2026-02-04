#!/usr/bin/env python3
"""
Generate the complete corrected plan.ts file with all 119 transactions
"""

import json

# Read the correct transactions
with open('period1_correct_transactions.json', 'r') as f:
    transactions = json.load(f)

# Generate the transactions section
ts_lines = []
for i, txn in enumerate(transactions):
    linked_rule = f'"{txn["linkedRuleId"]}"' if txn.get('linkedRuleId') else 'undefined'
    ts_line = f'    {{ id: "{txn["id"]}", date: "{txn["date"]}", label: "{txn["label"]}", amount: {txn["amount"]}, type: "{txn["type"]}", category: "{txn["category"]}", notes: "{txn["notes"]}", linkedRuleId: {linked_rule} }}'
    
    if i < len(transactions) - 1:
        ts_line += ','
    
    ts_lines.append(ts_line)

transactions_section = '\n'.join(ts_lines)

print(f"Generated {len(ts_lines)} transaction lines")
print(f"First transaction line:\n{ts_lines[0]}")
print(f"Last transaction line:\n{ts_lines[-1]}")
print()
print("Ready to replace in plan.ts")
