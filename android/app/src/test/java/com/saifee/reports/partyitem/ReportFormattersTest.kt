package com.saifee.reports.partyitem

import com.saifee.reports.partyitem.util.ReportFormatters
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests verifying quantity dual packaging formatting and INR currency formatting.
 */
class ReportFormattersTest {

    @Test
    fun `formatQuantity returns 0 when both base and loose are zero`() {
        assertEquals("0", ReportFormatters.formatQuantity(0L, 0L))
    }

    @Test
    fun `formatQuantity returns base only when loose is zero`() {
        assertEquals("2450", ReportFormatters.formatQuantity(2450L, 0L))
        assertEquals("100", ReportFormatters.formatQuantity(100L, 0L))
    }

    @Test
    fun `formatQuantity returns base plus loose when loose is greater than zero`() {
        assertEquals("1628 + 16", ReportFormatters.formatQuantity(1628L, 16L))
        assertEquals("10554 + 272", ReportFormatters.formatQuantity(10554L, 272L))
        assertEquals("0 + 5", ReportFormatters.formatQuantity(0L, 5L))
    }

    @Test
    fun `formatCurrencyINR formats standard amounts properly`() {
        val formattedZero = ReportFormatters.formatCurrencyINR(0.0)
        assert(formattedZero.contains("0.00")) { "Expected ₹ 0.00, got: $formattedZero" }

        val formattedAmount = ReportFormatters.formatCurrencyINR(184520.00)
        assert(formattedAmount.contains("1,84,520.00") || formattedAmount.contains("184,520.00")) {
            "Formatted amount should have currency decimals: $formattedAmount"
        }
    }
}
