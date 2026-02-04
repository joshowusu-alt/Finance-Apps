#!/usr/bin/env python3
"""
Calculate actual variance from plan.ts transactions (corrected)
"""

import re

# Read plan.ts
with open('cashflow-app/src/data/plan.ts', 'r') as f:
    content = f.read()

# Extract transactions
matches = re.findall(r'{ id: ("txn-\d+"), date: ("[\d-]+"), label: (".*?"), amount: ([\d.]+), type: ("(?:income|outflow|transfer)"), category: ("(?:income|bill|giving|savings|allowance|buffer|other)"), notes: (".*?")(, linkedRuleId: )?', content)

transactions = {}
for match in matches:
    txn_id, date, label, amount, txn_type, category, notes, _ = match
    amount = float(amount)
    transactions[txn_id] = {
        'date': date,
        'label': label.strip('"'),
        'amount': amount,
        'type': txn_type.strip('"'),
        'category': category.strip('"'),
        'notes': notes.strip('"'),
    }

print(f"Found {len(transactions)} transactions\n")

# Calculate actual totals
actuals = {}
for txn_id, txn in transactions.items():
    cat = txn['category']
    amt = txn['amount']
    
    if cat not in actuals:
        actuals[cat] = 0
    
    # Only count outflows, not transfers/income
    if txn['type'] == 'income':
        actuals['income'] = actuals.get('income', 0) + amt
    elif txn['type'] == 'transfer':
        # Transfers don't count toward expenditure variance
        pass
    else:  # outflow
        actuals[cat] = actuals.get(cat, 0) + amt

print("ACTUAL TOTALS FROM TRANSACTIONS:")
print("=" * 60)
total_actual = 0
for cat in ['income', 'bill', 'giving', 'allowance', 'savings', 'buffer', 'other']:
    if cat in actuals:
        print(f"{cat:12} £{actuals[cat]:10.2f}")
        total_actual += actuals[cat]
print("-" * 60)
print(f"{'TOTAL':12} £{total_actual:10.2f}")
print("=" * 60)

# Now list budgets from bills + rules
print()
print("BUDGETED TOTALS FROM BILLS + RULES:")
print("=" * 60)

# Income budget
income_budget = 4700  # From Excel

# Bills budget - all marked as category "bill"
bill_items = {
    'Rent': 550,
    'Insurance': 175,
    'Road Tax': 34,
    'Water Bill': 93,
    'Electricity & Gas': 200,
    'Community Fibre / Internet': 37,
    'iPhone Payments': 108,
    'Parents': 140,
    'Credit Card Payment': 400,
    'Fuel': 100,
    'House Keep': 560,
    'Laptop': 43,
    'One-Off Giving (Christmas)': 500,
}
bill_budget = sum(bill_items.values())

# Giving budget
giving_items = {
    'Tithe': 410,
    'Offerings': 165,
    'Charity - Perez Uni': 50,
    'Charity - JPC Utilities': 100,
    'Donations (Variable)': 90,
}
giving_budget = sum(giving_items.values())

# Allowance/Variable budget
allowance_budget = 150 + 150  # Food + Others from VARIABLE

# Savings budget
savings_budget = 1050

budgets = {
    'income': income_budget,
    'bill': bill_budget,
    'giving': giving_budget,
    'allowance': allowance_budget,
    'savings': savings_budget,
}

for cat in ['income', 'bill', 'giving', 'allowance', 'savings']:
    if cat in budgets:
        print(f"{cat:12} £{budgets[cat]:10.2f}")

print("=" * 60)

# Calculate variance
print()
print("VARIANCE ANALYSIS:")
print("=" * 60)
print(f"{'Category':<12} {'Budget':>12} {'Actual':>12} {'Variance':>12} {'%':>8} {'Status':>8}")
print("-" * 60)

total_budgeted = 0
total_actual_calc = 0

for cat in ['income', 'bill', 'giving', 'allowance', 'savings']:
    budget = budgets.get(cat, 0)
    actual = actuals.get(cat, 0)
    variance = actual - budget
    variance_pct = (variance / abs(budget)) * 100 if budget != 0 else 0
    status = "OVER" if variance > 5 else "UNDER" if variance < -5 else "OK"
    
    print(f"{cat:<12} £{budget:>10.2f} £{actual:>10.2f} £{variance:>10.2f} {variance_pct:>7.1f}% {status:>8}")
    
    total_budgeted += budget
    total_actual_calc += actual

print("-" * 60)
total_var = total_actual_calc - total_budgeted
total_pct = (total_var / total_budgeted) * 100 if total_budgeted != 0 else 0
print(f"{'TOTAL':<12} £{total_budgeted:>10.2f} £{total_actual_calc:>10.2f} £{total_var:>10.2f} {total_pct:>7.1f}%")
print("=" * 60)
