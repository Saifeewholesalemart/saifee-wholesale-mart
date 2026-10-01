package com.saifee.reports.partyitem.data.repository

import com.saifee.reports.partyitem.data.datasource.PartyItemMockDataSource
import com.saifee.reports.partyitem.domain.model.FilterOption
import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.domain.model.ReportFilters
import com.saifee.reports.partyitem.domain.model.ReportSummary
import com.saifee.reports.partyitem.domain.repository.PartyItemReportRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class PartyItemReportRepositoryImpl(
    private val dataSource: PartyItemMockDataSource = PartyItemMockDataSource()
) : PartyItemReportRepository {

    override fun getPartyReportItems(filters: ReportFilters): Flow<List<PartyReportItem>> = flow {
        // Retrieve base data from data source
        var items = dataSource.getSamplePartyReportItems()

        // Apply item filter simulation
        if (filters.itemId != "ALL") {
            // Simulated variation if specific item is selected
            items = items.map { item ->
                if (item.saleAmount > 0) {
                    item.copy(
                        saleQtyBase = (item.saleQtyBase * 0.35).toLong(),
                        saleQtyLoose = (item.saleQtyLoose * 0.5).toLong(),
                        saleAmount = item.saleAmount * 0.35
                    )
                } else {
                    item.copy(
                        purchaseQtyBase = (item.purchaseQtyBase * 0.4).toLong(),
                        purchaseQtyLoose = (item.purchaseQtyLoose * 0.5).toLong(),
                        purchaseAmount = item.purchaseAmount * 0.4
                    )
                }
            }
        }

        // Apply firm / godown variations if filtered
        if (filters.firmId != "ALL" || filters.godownId != "ALL") {
            items = items.filterIndexed { index, _ -> index % 2 == 0 }
        }

        emit(items)
    }

    override fun getReportSummary(filters: ReportFilters): Flow<ReportSummary> = flow {
        val items = dataSource.getSamplePartyReportItems()
        emit(ReportSummary.fromItems(items))
    }

    override suspend fun getFirms(): List<FilterOption> = dataSource.getFirms()
    override suspend fun getGodowns(): List<FilterOption> = dataSource.getGodowns()
    override suspend fun getCategories(): List<FilterOption> = dataSource.getCategories()
    override suspend fun getItems(): List<FilterOption> = dataSource.getItems()
}
