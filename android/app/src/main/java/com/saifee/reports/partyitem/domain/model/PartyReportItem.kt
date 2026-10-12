package com.saifee.reports.partyitem.domain.model

/**
 * Data entity representing an item row in the Item Report by Party.
 *
 * @property id Unique identifier for the product/record
 * @property srNo Serial index in the report
 * @property partyName Name of the item/product (or party for backward compatibility)
 * @property productName Name of the product
 * @property brand Brand of the product
 * @property packSize Pack size / variant specification
 * @property tradingUnit Trading unit (e.g. Box, Carton, Case)
 * @property saleQtyBase Base unit sale quantity (e.g., cartons/boxes) in date range
 * @property saleQtyLoose Loose unit sale quantity (e.g., individual pieces) in date range
 * @property saleAmount Total sales revenue generated in INR in date range
 * @property purchaseQtyBase Base unit purchase quantity in date range
 * @property purchaseQtyLoose Loose unit purchase quantity in date range
 * @property purchaseAmount Total purchase expenditure in INR in date range
 * @property closingInventoryBase Current physical stock in base trading units (e.g. Boxes)
 * @property closingInventoryLoose Current physical stock loose units
 * @property closingInventoryDisplay Formatted current physical stock (e.g. "35 Boxes")
 */
data class PartyReportItem(
    val id: String,
    val srNo: Int,
    val partyName: String,
    val productName: String = partyName,
    val brand: String = "",
    val packSize: String = "",
    val tradingUnit: String = "Box",
    val saleQtyBase: Long = 0L,
    val saleQtyLoose: Long = 0L,
    val saleAmount: Double = 0.0,
    val purchaseQtyBase: Long = 0L,
    val purchaseQtyLoose: Long = 0L,
    val purchaseAmount: Double = 0.0,
    val closingInventoryBase: Long = 0L,
    val closingInventoryLoose: Long = 0L,
    val closingInventoryDisplay: String = if (closingInventoryBase > 0) "$closingInventoryBase Boxes" else "0 Boxes"
) {
    val totalSalePieces: Long get() = saleQtyBase + saleQtyLoose
    val totalPurchasePieces: Long get() = purchaseQtyBase + purchaseQtyLoose
    val totalClosingPieces: Long get() = closingInventoryBase + closingInventoryLoose
}
