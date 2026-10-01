package com.saifee.reports.partyitem.domain.repository

import com.saifee.reports.partyitem.domain.model.FilterOption
import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.domain.model.ReportFilters
import com.saifee.reports.partyitem.domain.model.ReportSummary
import kotlinx.coroutines.flow.Flow

interface PartyItemReportRepository {
    fun getPartyReportItems(filters: ReportFilters): Flow<List<PartyReportItem>>
    fun getReportSummary(filters: ReportFilters): Flow<ReportSummary>
    suspend fun getFirms(): List<FilterOption>
    suspend fun getGodowns(): List<FilterOption>
    suspend fun getCategories(): List<FilterOption>
    suspend fun getItems(): List<FilterOption>
}
