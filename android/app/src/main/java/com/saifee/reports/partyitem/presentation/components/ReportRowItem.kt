package com.saifee.reports.partyitem.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.util.ReportFormatters

/**
 * Single data row composable for the Item Report By Party grid.
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

        // 2. Item / Product Column
        Box(
            modifier = Modifier
                .width(200.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Column {
                Text(
                    text = item.productName,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF0F172A),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (item.packSize.isNotBlank()) {
                    Text(
                        text = item.packSize,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Normal,
                        color = Color(0xFF64748B)
                    )
                }
            }
        }

        // 3. Sale Quantity Column
        Box(
            modifier = Modifier
                .width(115.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val saleQtyStr = if (item.saleQtyBase > 0 || item.saleQtyLoose > 0) {
                ReportFormatters.formatQuantity(item.saleQtyBase, item.saleQtyLoose) + " ${item.tradingUnit}"
            } else {
                "0"
            }
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
                .width(125.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val saleAmtStr = ReportFormatters.formatCurrencyINR(item.saleAmount)
            Text(
                text = saleAmtStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (item.saleAmount > 0) Color(0xFF15803D) else Color(0xFF94A3B8),
                textAlign = TextAlign.End
            )
        }

        // 5. Purchase Quantity Column
        Box(
            modifier = Modifier
                .width(115.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val purchaseQtyStr = if (item.purchaseQtyBase > 0 || item.purchaseQtyLoose > 0) {
                ReportFormatters.formatQuantity(item.purchaseQtyBase, item.purchaseQtyLoose) + " ${item.tradingUnit}"
            } else {
                "0"
            }
            Text(
                text = purchaseQtyStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (item.totalPurchasePieces > 0) Color(0xFF1E293B) else Color(0xFF94A3B8),
                textAlign = TextAlign.End
            )
        }

        // 6. Purchase Amount Column
        Box(
            modifier = Modifier
                .width(130.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val purchaseAmtStr = ReportFormatters.formatCurrencyINR(item.purchaseAmount)
            Text(
                text = purchaseAmtStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (item.purchaseAmount > 0) Color(0xFFB45309) else Color(0xFF94A3B8),
                textAlign = TextAlign.End
            )
        }

        // 7. Closing Inventory Column
        Box(
            modifier = Modifier
                .width(140.dp)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            val closingStr = if (item.closingInventoryDisplay.isNotBlank()) {
                item.closingInventoryDisplay
            } else if (item.closingInventoryBase > 0) {
                "${item.closingInventoryBase} ${item.tradingUnit}"
            } else {
                "0 ${item.tradingUnit}"
            }
            Text(
                text = closingStr,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = if (item.totalClosingPieces > 0) Color(0xFF1E3A8A) else Color(0xFF94A3B8),
                textAlign = TextAlign.End
            )
        }
    }
}
