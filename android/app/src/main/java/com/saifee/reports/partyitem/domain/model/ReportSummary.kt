package com.saifee.reports.partyitem.domain.model

/**
 * Aggregated summary totals for the Party Report By Item.
 *
 * @property totalSaleQtyBase Aggregated sum of base sale quantities
 * @property totalSaleQtyLoose Aggregated sum of loose sale quantities
 * @property totalSaleAmount Aggregated total revenue amount in INR
 * @property totalPurchaseQtyBase Aggregated sum of base purchase quantities
 * @property totalPurchaseQtyLoose Aggregated sum of loose purchase quantities
 * @property totalPurchaseAmount Aggregated total purchase expenditure amount in INR
 * @property recordCount Total number of parties/records matching current filter
 */
data class ReportSummary(
    val totalSaleQtyBase: Long = 0L,
    val totalSaleQtyLoose: Long = 0L,
    val totalSaleAmount: Double = 0.0,
    val totalPurchaseQtyBase: Long = 0L,
    val totalPurchaseQtyLoose: Long = 0L,
    val totalPurchaseAmount: Double = 0.0,
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

            for (item in items) {
                saleBase += item.saleQtyBase
                saleLoose += item.saleQtyLoose
                saleAmt += item.saleAmount
                purchaseBase += item.purchaseQtyBase
                purchaseLoose += item.purchaseQtyLoose
                purchaseAmt += item.purchaseAmount
            }

            return ReportSummary(
                totalSaleQtyBase = saleBase,
                totalSaleQtyLoose = saleLoose,
                totalSaleAmount = saleAmt,
                totalPurchaseQtyBase = purchaseBase,
                totalPurchaseQtyLoose = purchaseLoose,
                totalPurchaseAmount = purchaseAmt,
                recordCount = items.size
            )
        }
    }
}
