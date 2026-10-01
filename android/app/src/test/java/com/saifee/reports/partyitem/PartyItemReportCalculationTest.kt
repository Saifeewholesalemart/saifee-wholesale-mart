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
        assertEquals(0, summary.recordCount)
    }

    @Test
    fun `summary aggregates base and loose units correctly across mixed parties`() {
        val sampleItems = listOf(
            PartyReportItem(
                id = "P1",
                srNo = 1,
                partyName = "Aadinath enterprise ratlam",
                saleQtyBase = 1628L,
                saleQtyLoose = 16L,
                saleAmount = 184520.00,
                purchaseQtyBase = 0L,
                purchaseQtyLoose = 0L,
                purchaseAmount = 0.00
            ),
            PartyReportItem(
                id = "P2",
                srNo = 2,
                partyName = "Britannia Industries Ltd",
                saleQtyBase = 0L,
                saleQtyLoose = 0L,
                saleAmount = 0.00,
                purchaseQtyBase = 10554L,
                purchaseQtyLoose = 272L,
                purchaseAmount = 1145890.00
            ),
            PartyReportItem(
                id = "P3",
                srNo = 3,
                partyName = "Balaji Super Market",
                saleQtyBase = 2450L,
                saleQtyLoose = 8L,
                saleAmount = 269500.00,
                purchaseQtyBase = 500L,
                purchaseQtyLoose = 12L,
                purchaseAmount = 45000.00
            )
        )

        val summary = ReportSummary.fromItems(sampleItems)

        // Verify Sale quantities: 1628 + 0 + 2450 = 4078 base; 16 + 0 + 8 = 24 loose
        assertEquals(4078L, summary.totalSaleQtyBase)
        assertEquals(24L, summary.totalSaleQtyLoose)

        // Verify Sale amount: 184520 + 0 + 269500 = 454020.00
        assertEquals(454020.00, summary.totalSaleAmount, 0.001)

        // Verify Purchase quantities: 0 + 10554 + 500 = 11054 base; 0 + 272 + 12 = 284 loose
        assertEquals(11054L, summary.totalPurchaseQtyBase)
        assertEquals(284L, summary.totalPurchaseQtyLoose)

        // Verify Purchase amount: 0 + 1145890 + 45000 = 1190890.00
        assertEquals(1190890.00, summary.totalPurchaseAmount, 0.001)

        assertEquals(3, summary.recordCount)
    }

    @Test
    fun `edge case parties with zero quantities and amounts are handled without NaN or crash`() {
        val zeroItem = PartyReportItem(
            id = "P0",
            srNo = 1,
            partyName = "Zero Activity Party",
            saleQtyBase = 0L,
            saleQtyLoose = 0L,
            saleAmount = 0.0,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.0
        )

        val summary = ReportSummary.fromItems(listOf(zeroItem))
        assertEquals(0L, summary.totalSaleQtyBase)
        assertEquals(0.0, summary.totalSaleAmount, 0.001)
        assertEquals(1, summary.recordCount)
    }
}
