#!/usr/bin/env python3
"""
Generate TypeScript transactions from the correct Excel extraction
"""

import json

with open('period1_correct_transactions.json', 'r') as f:
    transactions = json.load(f)

# Generate TypeScript
ts_output = "    "
for i, txn in enumerate(transactions):
    linked_rule = f'"{txn["linkedRuleId"]}"' if txn.get('linkedRuleId') else 'undefined'
    ts_line = f'{{ id: "{txn["id"]}", date: "{txn["date"]}", label: "{txn["label"]}", amount: {txn["amount"]}, type: "{txn["type"]}", category: "{txn["category"]}", notes: "{txn["notes"]}", linkedRuleId: {linked_rule} }}'
    
    if i < len(transactions) - 1:
        ts_line += ','
    
    print(ts_line)
