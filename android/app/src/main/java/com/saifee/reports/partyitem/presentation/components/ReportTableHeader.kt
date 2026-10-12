package com.saifee.reports.partyitem.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.saifee.reports.partyitem.domain.model.SortColumnField
import com.saifee.reports.partyitem.domain.model.SortDirection
import com.saifee.reports.partyitem.domain.model.SortOrder

/**
 * Sticky table header composable for the Item Report By Party data grid.
 */
@Composable
fun ReportTableHeader(
    sortOrder: SortOrder,
    onSortColumnToggled: (SortColumnField) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFFE2E8F0)) // Crisp Slate header background
            .padding(vertical = 10.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 1. Serial No Column (#)
        Box(
            modifier = Modifier
                .width(44.dp)
                .clickable { onSortColumnToggled(SortColumnField.SR_NO) },
            contentAlignment = Alignment.Center
        ) {
            HeaderSortableCell(
                title = "#",
                column = SortColumnField.SR_NO,
                activeSort = sortOrder,
                textAlign = TextAlign.Center
            )
        }

        // 2. Item / Product Column
        Box(
            modifier = Modifier
                .width(200.dp)
                .clickable { onSortColumnToggled(SortColumnField.PARTY_NAME) }
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            HeaderSortableCell(
                title = "ITEM / PRODUCT",
                column = SortColumnField.PARTY_NAME,
                activeSort = sortOrder,
                textAlign = TextAlign.Start
            )
        }

        // 3. Sale Quantity Column
        Box(
            modifier = Modifier
                .width(115.dp)
                .clickable { onSortColumnToggled(SortColumnField.SALE_QTY) }
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            HeaderSortableCell(
                title = "SALE QTY",
                column = SortColumnField.SALE_QTY,
                activeSort = sortOrder,
                textAlign = TextAlign.End
            )
        }

        // 4. Sale Amount Column
        Box(
            modifier = Modifier
                .width(125.dp)
                .clickable { onSortColumnToggled(SortColumnField.SALE_AMOUNT) }
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            HeaderSortableCell(
                title = "SALE AMOUNT",
                column = SortColumnField.SALE_AMOUNT,
                activeSort = sortOrder,
                textAlign = TextAlign.End
            )
        }

        // 5. Purchase Quantity Column
        Box(
            modifier = Modifier
                .width(115.dp)
                .clickable { onSortColumnToggled(SortColumnField.PURCHASE_QTY) }
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            HeaderSortableCell(
                title = "PURCHASE QTY",
                column = SortColumnField.PURCHASE_QTY,
                activeSort = sortOrder,
                textAlign = TextAlign.End
            )
        }

        // 6. Purchase Amount Column
        Box(
            modifier = Modifier
                .width(130.dp)
                .clickable { onSortColumnToggled(SortColumnField.PURCHASE_AMOUNT) }
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            HeaderSortableCell(
                title = "PURCHASE AMOUNT",
                column = SortColumnField.PURCHASE_AMOUNT,
                activeSort = sortOrder,
                textAlign = TextAlign.End
            )
        }

        // 7. Closing Inventory Column
        Box(
            modifier = Modifier
                .width(140.dp)
                .clickable { onSortColumnToggled(SortColumnField.CLOSING_INVENTORY) }
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.CenterEnd
        ) {
            HeaderSortableCell(
                title = "CLOSING INVENTORY",
                column = SortColumnField.CLOSING_INVENTORY,
                activeSort = sortOrder,
                textAlign = TextAlign.End
            )
        }
    }
}

@Composable
private fun HeaderSortableCell(
    title: String,
    column: SortColumnField,
    activeSort: SortOrder,
    textAlign: TextAlign,
    modifier: Modifier = Modifier
) {
    val isCurrentSorted = activeSort.column == column
    val isAscending = activeSort.direction == SortDirection.ASCENDING

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = when (textAlign) {
            TextAlign.End -> Arrangement.End
            TextAlign.Center -> Arrangement.Center
            else -> Arrangement.Start
        }
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.Black,
                fontSize = 11.sp,
                letterSpacing = 0.5.sp
            ),
            color = if (isCurrentSorted) Color(0xFF1E3A8A) else Color(0xFF475569),
            textAlign = textAlign
        )

        Spacer(modifier = Modifier.width(3.dp))

        if (isCurrentSorted) {
            Icon(
                imageVector = if (isAscending) Icons.Filled.ArrowUpward else Icons.Filled.ArrowDownward,
                contentDescription = if (isAscending) "Sorted Ascending" else "Sorted Descending",
                tint = Color(0xFF2563EB),
                modifier = Modifier.size(13.dp)
            )
        } else {
            Icon(
                imageVector = Icons.Filled.UnfoldMore,
                contentDescription = "Sortable column",
                tint = Color(0xFF94A3B8),
                modifier = Modifier.size(13.dp)
            )
        }
    }
}
