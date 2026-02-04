import json

# Read the correct transactions
with open('period1_correct_transactions.json', 'r') as f:
    transactions = json.load(f)

# Generate TypeScript code for transactions array
ts_code = []
for i, txn in enumerate(transactions, 1):
    ts_code.append(f'    {{ id: "txn-{i}", date: "{txn["date"]}", label: "{txn["label"]}", amount: {txn["amount"]}, type: "{txn["type"]}", category: "{txn["category"]}", notes: "{txn["notes"]}", linkedRuleId: undefined }}' + (',', '')[i == len(transactions)])

# Print all transaction lines
print("Transactions array for plan.ts:")
print("="*120)
for line in ts_code:
    print(line)

# Save to file
with open('plan_transactions_section.ts', 'w') as f:
    f.write(',\n'.join(ts_code))

print()
print(f"Generated {len(ts_code)} transactions")
print("Saved to plan_transactions_section.ts")
