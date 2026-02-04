import openpyxl
import json

excel_file = "FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx"
wb = openpyxl.load_workbook(excel_file, data_only=True)

print("="*100)
print("PERIOD 1 BUDGET ANALYSIS FROM EXCEL")
print("="*100)

# Read Budget by Period - Period 1 (columns 2-4: Budget, Actuals, Variance)
ws = wb['Budget by Period']

print("\nBudget by Period Tab - Period 1 Breakdown:")
print("=" * 100)

budget_data = {}

# Read all rows
for i, row in enumerate(ws.iter_rows(min_row=1, max_row=30, values_only=True), 1):
    if i == 1:  # Header
        print(f"Header: Items={row[1]}, Budget={row[3]}, Actuals={row[4]}, Variance={row[5]}")
        continue
    
    if i >= 2:
        category_type = row[0]  # INCOME, GIVING, FIXED, VARIABLE, SAVINGS
        item_name = row[1]
        budget = row[3]
        actual = row[4]
        variance = row[5]
        
        if category_type and item_name:
            if category_type not in budget_data:
                budget_data[category_type] = []
            budget_data[category_type].append({
                'name': item_name,
                'budget': budget,
                'actual': actual,
                'variance': variance
            })
            print(f"{category_type:12} | {item_name:30} | Budget: £{budget if budget else 0:7.2f} | Actual: £{actual if actual else 0:7.2f} | Variance: £{variance if variance else 0:7.2f}")

# Totals by category
print("\n" + "="*100)
print("TOTALS BY CATEGORY (Period 1):")
print("="*100)

totals = {}
for cat_type, items in budget_data.items():
    budget_total = sum(item['budget'] or 0 for item in items)
    actual_total = sum(item['actual'] or 0 for item in items)
    variance_total = sum(item['variance'] or 0 for item in items)
    totals[cat_type] = {
        'budget': budget_total,
        'actual': actual_total,
        'variance': variance_total
    }
    print(f"{cat_type:12} | Budget: £{budget_total:8.2f} | Actual: £{actual_total:8.2f} | Variance: £{variance_total:8.2f}")

print("\n" + "="*100)
print("MAPPING TO APP CATEGORIES:")
print("="*100)

app_mapping = {
    'income': {
        'INCOME': ['Income - FM', 'Income - McD', 'Income - Outlier', 'Income - Gifts']
    },
    'bill': {
        'FIXED': ['Rent', 'Insurance', 'Road Tax', 'Water Bill', 'Electricity & Gas', 
                  'Community Fibre / Internet', 'iPhone Payments', 'Parents', 
                  'Credit Card Payment', 'Fuel', 'House Keep', 'Laptop']
    },
    'giving': {
        'GIVING': ['Tithe', 'Offerings', 'Charity - Perez Uni', 'Charity - JPC Utilities', 'Donations (Variable)']
    },
    'allowance': {
        'VARIABLE': ['Food', 'Others']
    },
    'savings': {
        'SAVINGS': ['Savings Transfer']
    },
    'other': {
        'FIXED': ['One-Off Giving (Christmas)']  # Miscellaneous
    }
}

print("\nRecommended App Categorization:")
print("-" * 100)

app_totals = {}
for app_cat, categories in app_mapping.items():
    budget_total = 0
    actual_total = 0
    variance_total = 0
    
    items_list = []
    for excel_cat, item_names in categories.items():
        if excel_cat in budget_data:
            for item in budget_data[excel_cat]:
                if item['name'] in item_names:
                    budget_total += item['budget'] or 0
                    actual_total += item['actual'] or 0
                    variance_total += item['variance'] or 0
                    items_list.append(item['name'])
    
    if budget_total > 0 or actual_total > 0:
        app_totals[app_cat] = {
            'budget': budget_total,
            'actual': actual_total,
            'variance': variance_total,
            'items': items_list
        }
        print(f"\n{app_cat.upper()}:")
        print(f"  Items: {', '.join(items_list)}")
        print(f"  Budget: £{budget_total:8.2f} | Actual: £{actual_total:8.2f} | Variance: £{variance_total:8.2f}")

print("\n" + "="*100)
print("CORRECTED APP VARIANCE (What it SHOULD show):")
print("="*100)

for cat, totals_data in app_totals.items():
    print(f"{cat:15} | Budget: £{totals_data['budget']:8.2f} | Actual: £{totals_data['actual']:8.2f} | Variance: £{totals_data['variance']:8.2f}")

