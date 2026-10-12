package com.saifee.reports.partyitem

import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.domain.model.ReportSummary
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests verifying aggregation calculations, total sum accuracy, and edge cases.
 */
class PartyItemReportCalculationTest {

    @Test
    fun `empty item list returns empty summary with zeros`() {
        val summary = ReportSummary.fromItems(emptyList())

        assertEquals(0L, summary.totalSaleQtyBase)
        assertEquals(0L, summary.totalSaleQtyLoose)
        assertEquals(0.0, summary.totalSaleAmount, 0.001)
        assertEquals(0L, summary.totalPurchaseQtyBase)
        assertEquals(0L, summary.totalPurchaseQtyLoose)
        assertEquals(0.0, summary.totalPurchaseAmount, 0.001)
        assertEquals(0L, summary.totalClosingInventoryBase)
        assertEquals(0, summary.recordCount)
    }

    @Test
    fun `summary aggregates base and loose units correctly across items`() {
        val sampleItems = listOf(
            PartyReportItem(
                id = "P1",
                srNo = 1,
                partyName = "Coragen 250ml",
                productName = "Coragen 250ml",
                tradingUnit = "Box",
                saleQtyBase = 20L,
                saleQtyLoose = 0L,
                saleAmount = 19000.00,
                purchaseQtyBase = 50L,
                purchaseQtyLoose = 0L,
                purchaseAmount = 42500.00,
                closingInventoryBase = 35L,
                closingInventoryLoose = 0L,
                closingInventoryDisplay = "35 Boxes"
            ),
            PartyReportItem(
                id = "P2",
                srNo = 2,
                partyName = "Parle Cookies 300g",
                productName = "Parle Cookies 300g",
                tradingUnit = "Carton",
                saleQtyBase = 10L,
                saleQtyLoose = 0L,
                saleAmount = 12000.00,
                purchaseQtyBase = 20L,
                purchaseQtyLoose = 0L,
                purchaseAmount = 18000.00,
                closingInventoryBase = 15L,
                closingInventoryLoose = 0L,
                closingInventoryDisplay = "15 Cartons"
            ),
            PartyReportItem(
                id = "P3",
                srNo = 3,
                partyName = "Britannia Good Day 75g",
                productName = "Britannia Good Day 75g",
                tradingUnit = "Carton",
                saleQtyBase = 45L,
                saleQtyLoose = 12L,
                saleAmount = 56250.00,
                purchaseQtyBase = 80L,
                purchaseQtyLoose = 0L,
                purchaseAmount = 88000.00,
                closingInventoryBase = 60L,
                closingInventoryLoose = 8L,
                closingInventoryDisplay = "60 Cartons + 8 Pcs"
            )
        )

        val summary = ReportSummary.fromItems(sampleItems)

        // Verify Sale quantities: 20 + 10 + 45 = 75 base; 0 + 0 + 12 = 12 loose
        assertEquals(75L, summary.totalSaleQtyBase)
        assertEquals(12L, summary.totalSaleQtyLoose)

        // Verify Sale amount: 19000 + 12000 + 56250 = 87250.00
        assertEquals(87250.00, summary.totalSaleAmount, 0.001)

        // Verify Purchase quantities: 50 + 20 + 80 = 150 base; 0 + 0 + 0 = 0 loose
        assertEquals(150L, summary.totalPurchaseQtyBase)
        assertEquals(0L, summary.totalPurchaseQtyLoose)

        // Verify Purchase amount: 42500 + 18000 + 88000 = 148500.00
        assertEquals(148500.00, summary.totalPurchaseAmount, 0.001)

        // Verify Closing Inventory: 35 + 15 + 60 = 110 base; 0 + 0 + 8 = 8 loose
        assertEquals(110L, summary.totalClosingInventoryBase)
        assertEquals(8L, summary.totalClosingInventoryLoose)

        assertEquals(3, summary.recordCount)
    }

    @Test
    fun `edge case items with zero quantities and amounts are handled without NaN or crash`() {
        val zeroItem = PartyReportItem(
            id = "P0",
            srNo = 1,
            partyName = "Zero Activity Item",
            productName = "Zero Activity Item",
            saleQtyBase = 0L,
            saleQtyLoose = 0L,
            saleAmount = 0.0,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.0,
            closingInventoryBase = 50L,
            closingInventoryDisplay = "50 Boxes"
        )

        val summary = ReportSummary.fromItems(listOf(zeroItem))
        assertEquals(0L, summary.totalSaleQtyBase)
        assertEquals(0.0, summary.totalSaleAmount, 0.001)
        assertEquals(50L, summary.totalClosingInventoryBase)
        assertEquals(1, summary.recordCount)
    }
}
