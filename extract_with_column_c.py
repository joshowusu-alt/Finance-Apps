#!/usr/bin/env python3
"""
Re-extract and categorize all transactions using Excel Column C as source of truth
"""

import openpyxl
import re
from datetime import datetime

wb = openpyxl.load_workbook('FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx', data_only=True)
trans_sheet = wb['Transactions']

# Mapping from Excel Bills Schedule / Budget by Period to app categories
category_mapping = {
    # Bills/Fixed
    'Rent': 'bill',
    'Insurance': 'bill',
    'Road Tax': 'bill',
    'Water Bill': 'bill',
    'Community Fibre / Internet': 'bill',
    'Electricity & Gas': 'bill',
    'iPhone Payments': 'bill',
    'Parents': 'bill',
    'Credit Card Payment': 'bill',
    'Fuel': 'bill',
    'House Keep': 'bill',
    'Laptop': 'bill',
    'One-Off Giving (Christmas)': 'bill',
    
    # Giving
    'Tithe': 'giving',
    'Tithe ': 'giving',  # with trailing space
    'Offerings': 'giving',
    'Charity - Perez Uni': 'giving',
    'Charity - JPC Utilities': 'giving',
    'Donations (Variable)': 'giving',
    
    # Allowance/Variable
    'Others': 'allowance',
    'Uber - TfL': 'allowance',
    
    # Savings
    'Savings Transfer': 'savings',
    
    # Income
    'Income - FM': 'income',
    'Income - McD': 'income',
    'Income - Outlier': 'income',
    'Income - Gifts': 'income',
}

transactions = []
txn_count = 0

for row in range(2, 2000):
    period = trans_sheet[f'I{row}'].value
    if period != 1:  # Only Period 1
        continue
    
    date_val = trans_sheet[f'A{row}'].value
    if not date_val:
        continue
    
    # Parse date
    if isinstance(date_val, str):
        try:
            date_obj = datetime.strptime(date_val, '%d/%m/%Y')
            date_str = date_obj.strftime('%Y-%m-%d')
        except:
            continue
    else:
        date_str = date_val.strftime('%Y-%m-%d') if date_val else None
    
    if not date_str:
        continue
    
    description = trans_sheet[f'D{row}'].value or ''
    category_col = trans_sheet[f'C{row}'].value or 'Others'
    amount = trans_sheet[f'E{row}'].value
    txn_type_raw = trans_sheet[f'B{row}'].value or 'Expense'
    
    if not amount:
        continue
    
    amount = float(amount)
    
    # Map type
    if 'Transfer' in category_col or 'Transfer' in str(description):
        txn_type = 'transfer'
    elif 'Income' in category_col or 'Income' in str(description):
        txn_type = 'income'
    else:
        txn_type = 'outflow'
    
    # Map category
    category = category_mapping.get(category_col, 'allowance')
    
    # Create transaction
    txn_count += 1
    txn = {
        'id': f'txn-{txn_count}',
        'date': date_str,
        'label': str(description)[:60],
        'amount': amount,
        'type': txn_type,
        'category': category,
        'notes': str(category_col),
        'linkedRuleId': 'savings' if txn_type == 'transfer' else None
    }
    
    transactions.append(txn)

print(f"Extracted {len(transactions)} transactions from Excel Period 1")
print()

# Count by category
by_cat = {}
for txn in transactions:
    cat = txn['category']
    by_cat[cat] = by_cat.get(cat, 0) + 1

print("Distribution by category:")
for cat in sorted(by_cat.keys()):
    print(f"  {cat}: {by_cat[cat]}")

# Count by type
by_type = {}
for txn in transactions:
    t = txn['type']
    by_type[t] = by_type.get(t, 0) + 1

print()
print("Distribution by type:")
for t in sorted(by_type.keys()):
    print(f"  {t}: {by_type[t]}")

# Show sample of final transactions
print()
print("Sample transactions:")
for txn in transactions[:5]:
    print(f"  {txn['id']}: {txn['date']} - {txn['label'][:40]} ({txn['category']}) £{txn['amount']:.2f}")

# Save to file for reference
import json
with open('period1_correct_transactions.json', 'w') as f:
    json.dump(transactions, f, indent=2)

print()
print("✓ Saved to period1_correct_transactions.json")
