import openpyxl

wb = openpyxl.load_workbook('FINAL_2026_Cashflow_System_AppleStyle_v3_Start22Dec2025 - Copy (2).xlsx', data_only=True)
bbp = wb['Budget by Period']

print('Budget by Period - Structure:')
print('=' * 100)
for row in range(1, 25):
    a = bbp[f'A{row}'].value
    b = bbp[f'B{row}'].value
    c = bbp[f'C{row}'].value
    d = bbp[f'D{row}'].value
    print(f'Row {row:2}: A={str(a):<30} B={str(b):<15} C={str(c):<15} D={str(d):<15}')
