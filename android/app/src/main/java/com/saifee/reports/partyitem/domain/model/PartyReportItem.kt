package com.saifee.reports.partyitem.domain.model

/**
 * Data entity representing a single party's sales and purchases for a specific item filter.
 *
 * @property id Unique identifier for the party/record
 * @property srNo Serial index in the report
 * @property partyName Name of the customer/retailer/supplier
 * @property saleQtyBase Base unit sale quantity (e.g., cartons/boxes)
 * @property saleQtyLoose Loose unit sale quantity (e.g., individual pieces)
 * @property saleAmount Total sales revenue generated from this party in INR
 * @property purchaseQtyBase Base unit purchase quantity from this party
 * @property purchaseQtyLoose Loose unit purchase quantity from this party
 * @property purchaseAmount Total purchase expenditure to this party in INR
 */
data class PartyReportItem(
    val id: String,
    val srNo: Int,
    val partyName: String,
    val saleQtyBase: Long = 0L,
    val saleQtyLoose: Long = 0L,
    val saleAmount: Double = 0.0,
    val purchaseQtyBase: Long = 0L,
    val purchaseQtyLoose: Long = 0L,
    val purchaseAmount: Double = 0.0
) {
    val totalSalePieces: Long get() = saleQtyBase + saleQtyLoose
    val totalPurchasePieces: Long get() = purchaseQtyBase + purchaseQtyLoose
}
