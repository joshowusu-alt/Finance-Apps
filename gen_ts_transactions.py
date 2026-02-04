import json

# Read the JSON file
with open('period1_transactions_final.json', 'r') as f:
    transactions = json.load(f)

# Convert to TypeScript format
print("transactions: [")
for i, txn in enumerate(transactions):
    linked_rule = f'linkedRuleId: "{txn["linkedRuleId"]}"' if txn.get("linkedRuleId") else 'linkedRuleId: undefined'
    
    print(f'    {{ id: "{txn["id"]}", date: "{txn["date"]}", label: "{txn["label"].replace('"', '\\"')}", amount: {txn["amount"]}, type: "{txn["type"]}", category: "{txn["category"]}", notes: "{txn["notes"].replace('"', '\\"')}", {linked_rule} }},')

print("  ],")

