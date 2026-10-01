package com.saifee.reports.partyitem.util

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/**
 * Utility functions for formatting INR currency and dual-unit packaging quantities.
 */
object ReportFormatters {

    private val inrSymbols = DecimalFormatSymbols(Locale("en", "IN")).apply {
        currencySymbol = "₹ "
    }

    /**
     * Formats an amount in Indian Numbering System: `₹ #,##,##0.00`
     * Example: 10554.0 -> "₹ 10,554.00", 0.0 -> "₹ 0.00"
     */
    fun formatCurrencyINR(amount: Double): String {
        val formatter = DecimalFormat("₹ ##,##,##0.00", inrSymbols)
        return formatter.format(amount)
    }

    /**
     * Formats dual-packaging quantity:
     * - If both base and loose are 0: returns "0"
     * - If loose > 0: returns "$base + $loose" (e.g., "1628 + 16", "10554 + 272")
     * - If loose == 0: returns "$base" (e.g., "1628", "0")
     */
    fun formatQuantity(baseQty: Long, looseQty: Long): String {
        return when {
            baseQty == 0L && looseQty == 0L -> "0"
            looseQty > 0L -> "$baseQty + $looseQty"
            else -> baseQty.toString()
        }
    }

    /**
     * Formats aggregate total dual-packaging quantity.
     */
    fun formatTotalQuantity(totalBase: Long, totalLoose: Long): String {
        return formatQuantity(totalBase, totalLoose)
    }
}
