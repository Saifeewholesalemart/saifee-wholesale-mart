package com.saifee.reports.partyitem.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.saifee.reports.partyitem.domain.model.ReportSummary
import com.saifee.reports.partyitem.util.ReportFormatters

/**
 * Sticky bottom summary row composable showing aggregated totals for sales and purchases.
 */
@Composable
fun ReportStickyFooter(
    summary: ReportSummary,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = Color(0xFF0F172A), // Premium Dark Slate Blue summary bar
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp, horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 1. Serial No / Label Column (#)
            Box(
                modifier = Modifier.width(44.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Σ",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF38BDF8),
                    textAlign = TextAlign.Center
                )
            }

            // 2. Total Label with Record Count
            Box(
                modifier = Modifier
                    .width(220.dp)
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Text(
                    text = "TOTAL (${summary.recordCount} Parties)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            }

            // 3. Total Sale Quantity Column
            Box(
                modifier = Modifier
                    .width(125.dp)
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                val totalSaleQty = ReportFormatters.formatQuantity(
                    summary.totalSaleQtyBase,
                    summary.totalSaleQtyLoose
                )
                Text(
                    text = totalSaleQty,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFFFDE047), // Gold accent
                    textAlign = TextAlign.End
                )
            }

            // 4. Total Sale Amount Column
            Box(
                modifier = Modifier
                    .width(135.dp)
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                val totalSaleAmt = ReportFormatters.formatCurrencyINR(summary.totalSaleAmount)
                Text(
                    text = totalSaleAmt,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF34D399), // Bright Emerald Green
                    textAlign = TextAlign.End
                )
            }

            // 5. Total Purchase Quantity Column
            Box(
                modifier = Modifier
                    .width(135.dp)
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                val totalPurchaseQty = ReportFormatters.formatQuantity(
                    summary.totalPurchaseQtyBase,
                    summary.totalPurchaseQtyLoose
                )
                Text(
                    text = totalPurchaseQty,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFFFDE047), // Gold accent
                    textAlign = TextAlign.End
                )
            }

            // 6. Total Purchase Amount Column
            Box(
                modifier = Modifier
                    .width(145.dp)
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                val totalPurchaseAmt = ReportFormatters.formatCurrencyINR(summary.totalPurchaseAmount)
                Text(
                    text = totalPurchaseAmt,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF60A5FA), // Bright Blue
                    textAlign = TextAlign.End
                )
            }
        }
    }
}
