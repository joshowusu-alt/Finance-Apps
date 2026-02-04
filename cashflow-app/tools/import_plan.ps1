param(
  [string]$Source = "C:\Users\josho\OneDrive\Documents\Finance-Apps\cashflow-app\_import_data.json",
  [string]$Destination = "C:\Users\josho\OneDrive\Documents\Finance-Apps\cashflow-app\src\data\plan.ts"
)

$raw = Get-Content $Source -Raw | ConvertFrom-Json
$setup = $raw.setup

function Get-SetupNum {
  param([string]$Key, [double]$Default)
  if ($setup.PSObject.Properties.Name -contains $Key) {
    $val = $setup.$Key
    if ($null -ne $val) {
      return [double]$val
    }
  }
  return $Default
}

function ExcelDateToIso {
  param([object]$Value, [string]$Fallback)
  if ($null -eq $Value -or $Value -eq "") {
    return $Fallback
  }
  try {
    return ([datetime]::FromOADate([double]$Value)).ToString("yyyy-MM-dd")
  } catch {
    return $Fallback
  }
}

function Get-BillCategory {
  param([string]$Label)
  $l = $Label.ToLower()
  if ($l -match "tithe|offering|charity|parents|giving") { return "giving" }
  if ($l -match "one-off giving") { return "giving" }
  if ($l -match "savings") { return "savings" }
  if ($l -match "allowance") { return "allowance" }
  return "bill"
}

function Get-TransactionCategory {
  param([string]$Category, [string]$Type)
  $c = ""
  if ($Category) { $c = $Category.ToLower() }
  if ($Type -eq "income") { return "income" }
  if ($c -match "savings") { return "savings" }
  if ($c -match "tithe|offering|charity|donation|parents|giving") { return "giving" }
  if ($c -match "house keep|food") { return "allowance" }
  if ($c -match "other|uber") { return "other" }
  return "bill"
}

$allowanceKey = $setup.PSObject.Properties.Name | Where-Object { $_ -like "Weekly Allowance*" } | Select-Object -First 1
$allowanceAmount = if ($allowanceKey) { [double]$setup.$allowanceKey } else { 0 }

$asOf = if ($raw.asOfDate) { $raw.asOfDate } else { $raw.periods[0].start }
$windowDays = if ($raw.windowDays) { [int]([double]$raw.windowDays) } else { 30 }

$fmAmount = Get-SetupNum "FM payday amount (monthly)" 0
$mcdAmount = Get-SetupNum "McD payday amount (biweekly)" 0
$outlierAmount = Get-SetupNum "Outlier payday amount (weekly)" 0
$savingsAmount = Get-SetupNum "Monthly savings transfer target" 0
$variableCap = Get-SetupNum "Variable cap per period (Food+Donations+Others+One-offs)" 0

$mcdSeed = ExcelDateToIso $setup.'McD next payday date (seed)' "2026-01-01"
$outlierSeed = ExcelDateToIso $setup.'Outlier next payday date (seed - Wed)' "2026-01-07"

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('export type CashflowCategory =')
$lines.Add('  | "income"')
$lines.Add('  | "bill"')
$lines.Add('  | "giving"')
$lines.Add('  | "savings"')
$lines.Add('  | "allowance"')
$lines.Add('  | "buffer"')
$lines.Add('  | "other";')
$lines.Add('')
$lines.Add('export type CashflowType = "income" | "outflow" | "transfer";')
$lines.Add('')
$lines.Add('export type CashflowEvent = {')
$lines.Add('  id: string;')
$lines.Add('  date: string; // YYYY-MM-DD')
$lines.Add('  label: string;')
$lines.Add('  amount: number;')
$lines.Add('  type: CashflowType;')
$lines.Add('  category: CashflowCategory;')
$lines.Add('  sourceId?: string;')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type Period = {')
$lines.Add('  id: number;')
$lines.Add('  label: string;')
$lines.Add('  start: string; // YYYY-MM-DD')
$lines.Add('  end: string; // YYYY-MM-DD')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type Recurrence = "weekly" | "biweekly" | "monthly";')
$lines.Add('')
$lines.Add('export type IncomeRule = {')
$lines.Add('  id: string;')
$lines.Add('  label: string;')
$lines.Add('  amount: number;')
$lines.Add('  cadence: Recurrence;')
$lines.Add('  seedDate: string; // YYYY-MM-DD')
$lines.Add('  enabled: boolean;')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type OutflowRule = {')
$lines.Add('  id: string;')
$lines.Add('  label: string;')
$lines.Add('  amount: number;')
$lines.Add('  cadence: Recurrence;')
$lines.Add('  seedDate: string; // YYYY-MM-DD')
$lines.Add('  category: CashflowCategory;')
$lines.Add('  enabled: boolean;')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type BillTemplate = {')
$lines.Add('  id: string;')
$lines.Add('  label: string;')
$lines.Add('  amount: number;')
$lines.Add('  dueDay: number; // day of month')
$lines.Add('  category: CashflowCategory;')
$lines.Add('  enabled: boolean;')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type CashflowOverride = {')
$lines.Add('  id: string;')
$lines.Add('  ruleId?: string;')
$lines.Add('  date: string;')
$lines.Add('  label: string;')
$lines.Add('  amount: number;')
$lines.Add('  type: CashflowType;')
$lines.Add('  category: CashflowCategory;')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type Transaction = {')
$lines.Add('  id: string;')
$lines.Add('  date: string; // YYYY-MM-DD')
$lines.Add('  label: string;')
$lines.Add('  amount: number;')
$lines.Add('  type: CashflowType;')
$lines.Add('  category: CashflowCategory;')
$lines.Add('  notes?: string;')
$lines.Add('  linkedRuleId?: string; // for transfers, link to savings/outflow rule')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type PlanSetup = {')
$lines.Add('  selectedPeriodId: number;')
$lines.Add('  asOfDate: string; // YYYY-MM-DD')
$lines.Add('  windowDays: number;')
$lines.Add('  startingBalance: number;')
$lines.Add('  expectedMinBalance: number;')
$lines.Add('  variableCap: number;')
$lines.Add('};')
$lines.Add('')
$lines.Add('export type Plan = {')
$lines.Add('  setup: PlanSetup;')
$lines.Add('  periods: Period[];')
$lines.Add('  incomeRules: IncomeRule[];')
$lines.Add('  outflowRules: OutflowRule[];')
$lines.Add('  bills: BillTemplate[];')
$lines.Add('  overrides: CashflowOverride[];')
$lines.Add('  transactions: Transaction[];')
$lines.Add('};')
$lines.Add('')
$lines.Add('export const PLAN: Plan = {')
$lines.Add('  setup: {')
$lines.Add('    selectedPeriodId: 1,')
$lines.Add(("    asOfDate: ""{0}""," -f $asOf))
$lines.Add(("    windowDays: {0}," -f $windowDays))
$lines.Add('    startingBalance: 0,')
$lines.Add('    expectedMinBalance: 900,')
$lines.Add(("    variableCap: {0}," -f $variableCap))
$lines.Add('  },')
$lines.Add('  periods: [')
foreach ($p in $raw.periods) {
  $label = ($p.label -replace '–','-').Replace('"','\\\"')
  $lines.Add(("    {{ id: {0}, label: ""{1}"", start: ""{2}"", end: ""{3}"" }}," -f $p.id, $label, $p.start, $p.end))
}
$lines.Add('  ],')
$lines.Add('  incomeRules: [')
$lines.Add(("    {{ id: ""fm"", label: ""FM income"", amount: {0}, cadence: ""monthly"", seedDate: ""2025-12-26"", enabled: true }}," -f $fmAmount))
$lines.Add(("    {{ id: ""mcd"", label: ""McD income"", amount: {0}, cadence: ""biweekly"", seedDate: ""{1}"", enabled: true }}," -f $mcdAmount, $mcdSeed))
$lines.Add(("    {{ id: ""outlier"", label: ""Outlier income"", amount: {0}, cadence: ""weekly"", seedDate: ""{1}"", enabled: true }}," -f $outlierAmount, $outlierSeed))
$lines.Add('  ],')
$lines.Add('  outflowRules: [')
if ($savingsAmount -gt 0) {
  $lines.Add(("    {{ id: ""savings"", label: ""Savings transfer"", amount: {0}, cadence: ""monthly"", seedDate: ""2025-12-29"", category: ""savings"", enabled: true }}," -f $savingsAmount))
}
if ($allowanceAmount -gt 0) {
  $lines.Add(("    {{ id: ""allowance"", label: ""Weekly allowance"", amount: {0}, cadence: ""weekly"", seedDate: ""2025-12-29"", category: ""allowance"", enabled: true }}," -f $allowanceAmount))
}
$lines.Add('  ],')
$lines.Add('  bills: [')
foreach ($b in $raw.bills) {
  if ($b.label -in @('Savings Transfer','House Keep')) { continue }
  $slug = ($b.label.ToLower() -replace '[^a-z0-9-]', '-') -replace '-+', '-'
  $slug = $slug.Trim('-')
  $cat = Get-BillCategory $b.label
  $lines.Add(("    {{ id: ""{0}"", label: ""{1}"", amount: {2}, dueDay: {3}, category: ""{4}"", enabled: true }}," -f $slug, $b.label, $b.amount, $b.dueDay, $cat))
}
$lines.Add('  ],')
$lines.Add('  overrides: [')
$lines.Add('    { id: "fm-early-2025-12-22", ruleId: "fm", date: "2025-12-22", label: "FM income (early)", amount: 3500, type: "income", category: "income" },')
$lines.Add('  ],')
$lines.Add('  transactions: [')
$idx = 1
foreach ($t in $raw.transactions) {
  if (-not $t.date) { continue }
  $ttype = if ($t.type) { $t.type.ToLower() } else { "outflow" }
  if ($ttype -eq "income") { $type = "income" } elseif ($ttype -eq "transfer") { $type = "transfer" } else { $type = "outflow" }
  $cat = Get-TransactionCategory $t.category $type
  $label = if ($t.label) { $t.label } elseif ($t.category) { $t.category } else { "Transaction" }
  $label = $label.Replace('"','\\\"')
  $notes = if ($t.category) { '"' + $t.category.Replace('"','\\\"') + '"' } else { "undefined" }
  $linked = if ($type -eq "transfer" -and $cat -eq "savings") { '"savings"' } else { "undefined" }
  $lines.Add(("    {{ id: ""txn-{0}"", date: ""{1}"", label: ""{2}"", amount: {3}, type: ""{4}"", category: ""{5}"", notes: {6}, linkedRuleId: {7} }}," -f $idx, $t.date, $label, $t.amount, $type, $cat, $notes, $linked))
  $idx++
}
$lines.Add('  ],')
$lines.Add('};')

Set-Content -Path $Destination -Value $lines -Encoding UTF8
