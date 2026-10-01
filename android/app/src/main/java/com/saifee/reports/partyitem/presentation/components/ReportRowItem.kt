package com.saifee.reports.partyitem.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.util.ReportFormatters

/**
 * Single data row composable for the Party Report By Item grid.
 */
@Composable
fun ReportRowItem(
    item: PartyReportItem,
    isEvenRow: Boolean,
    modifier: Modifier = Modifier
) {
    val rowBackground = if (isEvenRow) Color(0xFFF8FAFC) else Color.White

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(rowBackground)
            .padding(vertical = 11.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 1. Serial No Column (#)
        Box(
            modifier = Modifier.width(44.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = item.srNo.toString(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF64748B),
                textAlign = TextAlign.Center
            )
        }

        // 2. Party Name Column
        Box(
            modifier = Modifier
                .width(220.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = item.partyName,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF0F172A),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }

        // 3. Sale Quantity Column (dual format: e.g. "1628 + 16" or "2450")
        Box(
            modifier = Modifier
                .width(125.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val saleQtyStr = ReportFormatters.formatQuantity(item.saleQtyBase, item.saleQtyLoose)
            Text(
                text = saleQtyStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (item.totalSalePieces > 0) Color(0xFF1E293B) else Color(0xFF94A3B8),
                textAlign = TextAlign.End
            )
        }

        // 4. Sale Amount Column (currency INR: ₹ #,##,##0.00)
        Box(
            modifier = Modifier
                .width(135.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val saleAmtStr = ReportFormatters.formatCurrencyINR(item.saleAmount)
            Text(
                text = saleAmtStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (item.saleAmount > 0) Color(0xFF047857) else Color(0xFF94A3B8), // Green for revenue
                textAlign = TextAlign.End
            )
        }

        // 5. Purchase Quantity Column (dual format: e.g. "10554 + 272")
        Box(
            modifier = Modifier
                .width(135.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val purchaseQtyStr = ReportFormatters.formatQuantity(item.purchaseQtyBase, item.purchaseQtyLoose)
            Text(
                text = purchaseQtyStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (item.totalPurchasePieces > 0) Color(0xFF1E293B) else Color(0xFF94A3B8),
                textAlign = TextAlign.End
            )
        }

        // 6. Purchase Amount Column (currency INR: ₹ #,##,##0.00)
        Box(
            modifier = Modifier
                .width(145.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val purchaseAmtStr = ReportFormatters.formatCurrencyINR(item.purchaseAmount)
            Text(
                text = purchaseAmtStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (item.purchaseAmount > 0) Color(0xFF1D4ED8) else Color(0xFF94A3B8), // Blue for purchase
                textAlign = TextAlign.End
            )
        }
    }
}
