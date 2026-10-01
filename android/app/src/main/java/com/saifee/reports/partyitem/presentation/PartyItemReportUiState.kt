package com.saifee.reports.partyitem.presentation

import com.saifee.reports.partyitem.domain.model.FilterOption
import com.saifee.reports.partyitem.domain.model.PartyReportItem
import com.saifee.reports.partyitem.domain.model.ReportFilters
import com.saifee.reports.partyitem.domain.model.ReportSummary
import com.saifee.reports.partyitem.domain.model.SortOrder

/**
 * State container for the Party Report By Item screen.
 */
data class PartyItemReportUiState(
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val items: List<PartyReportItem> = emptyList(),
    val summary: ReportSummary = ReportSummary.EMPTY,
    val filters: ReportFilters = ReportFilters(),
    val sortOrder: SortOrder = SortOrder(),
    val firmOptions: List<FilterOption> = emptyList(),
    val godownOptions: List<FilterOption> = emptyList(),
    val categoryOptions: List<FilterOption> = emptyList(),
    val itemOptions: List<FilterOption> = emptyList(),
    val exportFeedbackMessage: String? = null
)
