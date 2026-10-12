package com.saifee.reports.partyitem.domain.model

/**
 * Aggregated summary totals for the Item Report By Party.
 *
 * @property totalSaleQtyBase Aggregated sum of base sale quantities
 * @property totalSaleQtyLoose Aggregated sum of loose sale quantities
 * @property totalSaleAmount Aggregated total revenue amount in INR
 * @property totalPurchaseQtyBase Aggregated sum of base purchase quantities
 * @property totalPurchaseQtyLoose Aggregated sum of loose purchase quantities
 * @property totalPurchaseAmount Aggregated total purchase expenditure amount in INR
 * @property totalClosingInventoryBase Aggregated sum of current physical inventory base units
 * @property totalClosingInventoryLoose Aggregated sum of current physical inventory loose units
 * @property totalClosingDisplay Formatted display string for closing inventory totals
 * @property recordCount Total number of items matching current filter
 */
data class ReportSummary(
    val totalSaleQtyBase: Long = 0L,
    val totalSaleQtyLoose: Long = 0L,
    val totalSaleAmount: Double = 0.0,
    val totalPurchaseQtyBase: Long = 0L,
    val totalPurchaseQtyLoose: Long = 0L,
    val totalPurchaseAmount: Double = 0.0,
    val totalClosingInventoryBase: Long = 0L,
    val totalClosingInventoryLoose: Long = 0L,
    val totalClosingDisplay: String = "0 Boxes",
    val recordCount: Int = 0
) {
    companion object {
        val EMPTY = ReportSummary()

        /**
         * Computes the aggregated summary from a list of [PartyReportItem].
         */
        fun fromItems(items: List<PartyReportItem>): ReportSummary {
            if (items.isEmpty()) return EMPTY

            var saleBase = 0L
            var saleLoose = 0L
            var saleAmt = 0.0
            var purchaseBase = 0L
            var purchaseLoose = 0L
            var purchaseAmt = 0.0
            var closingBase = 0L
            var closingLoose = 0L

            for (item in items) {
                saleBase += item.saleQtyBase
                saleLoose += item.saleQtyLoose
                saleAmt += item.saleAmount
                purchaseBase += item.purchaseQtyBase
                purchaseLoose += item.purchaseQtyLoose
                purchaseAmt += item.purchaseAmount
                closingBase += item.closingInventoryBase
                closingLoose += item.closingInventoryLoose
            }

            return ReportSummary(
                totalSaleQtyBase = saleBase,
                totalSaleQtyLoose = saleLoose,
                totalSaleAmount = saleAmt,
                totalPurchaseQtyBase = purchaseBase,
                totalPurchaseQtyLoose = purchaseLoose,
                totalPurchaseAmount = purchaseAmt,
                totalClosingInventoryBase = closingBase,
                totalClosingInventoryLoose = closingLoose,
                totalClosingDisplay = if (closingBase > 0) "$closingBase Boxes" else "0 Boxes",
                recordCount = items.size
            )
        }
    }
}
