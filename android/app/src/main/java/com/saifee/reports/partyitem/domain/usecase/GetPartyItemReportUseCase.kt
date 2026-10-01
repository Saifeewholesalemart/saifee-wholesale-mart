package com.saifee.reports.partyitem.domain.usecase

import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.domain.model.ReportFilters
import com.saifee.reports.partyitem.domain.model.ReportSummary
import com.saifee.reports.partyitem.domain.model.SortColumnField
import com.saifee.reports.partyitem.domain.model.SortDirection
import com.saifee.reports.partyitem.domain.model.SortOrder
import com.saifee.reports.partyitem.domain.repository.PartyItemReportRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Clean architecture Use Case that retrieves, filters, searches, and sorts party report items.
 */
class GetPartyItemReportUseCase(
    private val repository: PartyItemReportRepository
) {
    operator fun invoke(
        filters: ReportFilters,
        sortOrder: SortOrder
    ): Flow<Pair<List<PartyReportItem>, ReportSummary>> {
        return repository.getPartyReportItems(filters).map { rawItems ->
            // Filter by search query (case-insensitive party name search)
            val filtered = if (filters.searchQuery.isBlank()) {
                rawItems
            } else {
                val query = filters.searchQuery.trim().lowercase()
                rawItems.filter { it.partyName.lowercase().contains(query) }
            }

            // Apply Sort Order
            val sorted = when (sortOrder.column) {
                SortColumnField.SR_NO -> {
                    if (sortOrder.direction == SortDirection.ASCENDING) {
                        filtered.sortedBy { it.srNo }
                    } else {
                        filtered.sortedByDescending { it.srNo }
                    }
                }
                SortColumnField.PARTY_NAME -> {
                    if (sortOrder.direction == SortDirection.ASCENDING) {
                        filtered.sortedBy { it.partyName.lowercase() }
                    } else {
                        filtered.sortedByDescending { it.partyName.lowercase() }
                    }
                }
                SortColumnField.SALE_QTY -> {
                    if (sortOrder.direction == SortDirection.ASCENDING) {
                        filtered.sortedBy { it.totalSalePieces }
                    } else {
                        filtered.sortedByDescending { it.totalSalePieces }
                    }
                }
                SortColumnField.SALE_AMOUNT -> {
                    if (sortOrder.direction == SortDirection.ASCENDING) {
                        filtered.sortedBy { it.saleAmount }
                    } else {
                        filtered.sortedByDescending { it.saleAmount }
                    }
                }
                SortColumnField.PURCHASE_QTY -> {
                    if (sortOrder.direction == SortDirection.ASCENDING) {
                        filtered.sortedBy { it.totalPurchasePieces }
                    } else {
                        filtered.sortedByDescending { it.totalPurchasePieces }
                    }
                }
                SortColumnField.PURCHASE_AMOUNT -> {
                    if (sortOrder.direction == SortDirection.ASCENDING) {
                        filtered.sortedBy { it.purchaseAmount }
                    } else {
                        filtered.sortedByDescending { it.purchaseAmount }
                    }
                }
            }

            // Re-index serial number post filtering/sorting
            val reIndexed = sorted.mapIndexed { index, item ->
                item.copy(srNo = index + 1)
            }

            // Compute summary
            val summary = ReportSummary.fromItems(reIndexed)

            Pair(reIndexed, summary)
        }
    }
}
