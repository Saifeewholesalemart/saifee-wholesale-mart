package com.saifee.reports.partyitem.domain.model

enum class DatePreset(val label: String) {
    THIS_MONTH("This Month"),
    TODAY("Today"),
    THIS_WEEK("This Week"),
    THIS_QUARTER("This Quarter"),
    CUSTOM("Custom")
}

data class FilterOption(
    val id: String,
    val name: String
)

/**
 * Filter parameters applied to the Party Report By Item query.
 */
data class ReportFilters(
    val datePreset: DatePreset = DatePreset.THIS_MONTH,
    val startDate: String = "01/09/2026",
    val endDate: String = "30/09/2026",
    val firmId: String = "ALL",
    val godownId: String = "ALL",
    val categoryId: String = "ALL",
    val itemId: String = "ALL",
    val searchQuery: String = ""
)
