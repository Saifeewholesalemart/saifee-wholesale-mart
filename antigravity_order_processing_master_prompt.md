<!-- ... existing code ... -->
## 1. CRITICAL FMCG RATE & PRICING CALCULATIONS (FIX MATHEMATICAL FLAWS)

### A. Unit Rate vs. Line Taxable Amount (CRITICAL BUG FIX)
* **The Problem:** Never populate the "Billed Rate / Carton" (or `/Bag`) field with the line taxable subtotal or aggregated order subtotal.
* **The Math:**
  $$\text{Line Gross Total (Incl. GST)} = \text{₹}2,415.00$$
  $$\text{Line Taxable Subtotal} = \frac{\text{Gross Total}}{1 + (\text{GST} / 100)} = \frac{2415}{1.05} = \text{₹}2,300.00$$
  $$\text{Unit Billed Rate per Carton} = \frac{\text{Line Taxable Subtotal}}{\text{Total Billed Quantity (Cartons)}} = \frac{2300}{2} = \mathbf{\text{₹}1,150.00\text{/ctn}}$$
* **Where the bug recurs in Step 2 (1-Bill Engine / Deduplication):**
  When orders are merged and aggregated:
  ```javascript
  // ❌ WRONG: Do NOT sum or copy the order line taxable value into the unit rate field:
  // aggregatedItem.rate = totalLineTaxable; 

  // ✅ CORRECT: Preserve the true unit rate per carton/bag:
  aggregatedItem.billedRate = sourceItem.billedRatePerUnit 
    || (totalTaxableSubtotal / totalBilledUnits);
  ```
* **Strict Rule:**
  1. The `BILLED RATE` input box in both the Order Register and Step 2 (`SKU Deduplication & Commercial Rate Audit`) **MUST ALWAYS** bind to the **Unit Rate per trading unit (₹/Carton, ₹/Bag, or ₹/Box)**.
  2. Multiplying `BILLED RATE` $\times$ `BILLED QTY` must equal the **Line Taxable Subtotal (before GST)**.
  3. Adding GST on top gives the `LINE TOTAL (INCL. GST)`.

### B. Distributor Margin Calculation
* Margin percentage must be calculated strictly from the **Unit Billed Rate** vs. the **Distributor Cost / Landing Rate**:
  $$\text{Margin \%} = \frac{\text{Unit Billed Rate} - \text{Unit Cost Rate}}{\text{Unit Billed Rate}} \times 100$$
  * *Example (Aashirvaad MP Atta 5kg):*
    * Landing Cost = $\text{₹}1,050.00\text{/ctn}$
    * Unit Billed Rate = $\text{₹}1,150.00\text{/ctn}$
    $$\text{Margin \%} = \frac{1150.00 - 1050.00}{1150.00} \times 100 = \mathbf{+8.70\%}$$
  * Do NOT calculate margin using the total line value, gross invoice total, or MRP.

---

## 2. STEP 2 OF 3: SKU DEDUPLICATION & MARGIN AUDIT (MODAL REFACTOR)

### Strict Aggregation Logic for 1-Bill Engine:
When aggregating items across multiple orders for a retailer:

```javascript
// Step 2 Aggregation Pattern
const aggregatedLines = {};

selectedOrders.forEach(order => {
  order.items.forEach(item => {
    // 1. Composite key preserves Dual MRP separation
    const key = `${item.sku}__MRP_${item.mrp}`;

    if (!aggregatedLines[key]) {
      aggregatedLines[key] = {
        key,
        sku: item.sku,
        name: item.name,
        mrp: Number(item.mrp),
        costPerUnit: Number(item.purchaseCostPerUnit), // e.g. 1050.00
        billedRatePerUnit: Number(item.billedRatePerUnit), // e.g. 1150.00 (NOT order total!)
        unitType: item.unitType || 'Carton', // 'Carton', 'Bag', 'Box'
        packConfig: item.packConfig,
        gstRate: Number(item.gstRate || 0),
        hsn: item.hsn,
        totalOrderedQty: 0,
        billedQtyCartons: 0,
        billedQtyLoose: 0
      };
    }

    // 2. Accumulate quantities only
    aggregatedLines[key].totalOrderedQty += Number(item.orderedCartons || 0);
    aggregatedLines[key].billedQtyCartons += Number(item.billedCartons || item.orderedCartons || 0);
  });
});
```

### Table Column Data Binding in Step 2:
1. **PRODUCT & MRP:** Product name, `MRP ₹X` badge, SKU, Pack details, and HSN.
2. **PURCHASE COST & MARGIN:** `₹{costPerUnit}/{unitType}` and live badge `+{margin}% Margin`.
3. **TOTAL ORDERED:** `{totalOrderedQty} Cartons` (or Bags).
4. **BILLED QTY:** Editable inputs for Cartons + Loose units.
5. **BILLED RATE:** Input displaying **Unit Rate per Carton/Bag** (e.g. `₹ 1150 /Carton`), **NEVER** the line subtotal (`₹ 2300`).
6. **LINE TOTAL (INCL. GST):** Calculated reactively as:
   $$\text{Taxable} = \text{Billed Qty} \times \text{Unit Billed Rate}$$
   $$\text{Line Total} = \text{Taxable} \times \left(1 + \frac{\text{GST \%}}{100}\right)$$
7. **ACTIONS:** Trigger for `Last 5 Rates` drawer.
<!-- ... existing code ... -->