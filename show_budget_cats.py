import openpyxl

wb = openpyxl.load_workbook('FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx', data_only=True)
bbp = wb['Budget by Period']

print('Budget by Period - All Categories:')
print('=' * 60)

categories = {}
for row in range(2, 35):
    category = bbp[f'A{row}'].value
    item = bbp[f'B{row}'].value
    budget = bbp[f'C{row}'].value
    
    if category and item and budget:
        if category not in categories:
            categories[category] = {'items': [], 'total': 0}
        categories[category]['items'].append((item, float(budget)))
        categories[category]['total'] += float(budget)

for cat in ['INCOME', 'GIVING', 'FIXED', 'VARIABLE', 'SAVINGS', 'ONE-OFF']:
    if cat in categories:
        print(f'{cat}:')
        for item, amt in categories[cat]['items']:
            print(f'  {item:<40} £{amt:8.2f}')
        print(f'  SUBTOTAL £{categories[cat]["total"]:8.2f}')
        print()
