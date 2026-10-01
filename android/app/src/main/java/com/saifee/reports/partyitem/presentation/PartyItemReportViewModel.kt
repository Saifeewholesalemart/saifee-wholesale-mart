package com.saifee.reports.partyitem.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saifee.reports.partyitem.data.repository.PartyItemReportRepositoryImpl
import com.saifee.reports.partyitem.domain.model.DatePreset
import com.saifee.reports.partyitem.domain.model.ReportFilters
import com.saifee.reports.partyitem.domain.model.SortColumnField
import com.saifee.reports.partyitem.domain.model.SortOrder
import com.saifee.reports.partyitem.domain.repository.PartyItemReportRepository
import com.saifee.reports.partyitem.domain.usecase.GetPartyItemReportUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class PartyItemReportViewModel(
    private val repository: PartyItemReportRepository = PartyItemReportRepositoryImpl(),
    private val getPartyItemReportUseCase: GetPartyItemReportUseCase = GetPartyItemReportUseCase(repository)
) : ViewModel() {

    private val _uiState = MutableStateFlow(PartyItemReportUiState())
    val uiState: StateFlow<PartyItemReportUiState> = _uiState.asStateFlow()

    private var reportJob: Job? = null

    init {
        loadFilterOptions()
        loadReport()
    }

    private fun loadFilterOptions() {
        viewModelScope.launch {
            try {
                val firms = repository.getFirms()
                val godowns = repository.getGodowns()
                val categories = repository.getCategories()
                val items = repository.getItems()

                _uiState.update { current ->
                    current.copy(
                        firmOptions = firms,
                        godownOptions = godowns,
                        categoryOptions = categories,
                        itemOptions = items
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Failed to load filter options: ${e.message}") }
            }
        }
    }

    fun loadReport() {
        reportJob?.cancel()
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        val currentFilters = _uiState.value.filters
        val currentSort = _uiState.value.sortOrder

        reportJob = getPartyItemReportUseCase(currentFilters, currentSort)
            .onEach { (items, summary) ->
                _uiState.update { current ->
                    current.copy(
                        isLoading = false,
                        items = items,
                        summary = summary,
                        errorMessage = null
                    )
                }
            }
            .catch { error ->
                _uiState.update { current ->
                    current.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "An unexpected error occurred while loading report."
                    )
                }
            }
            .launchIn(viewModelScope)
    }

    fun onDatePresetSelected(preset: DatePreset) {
        val (start, end) = when (preset) {
            DatePreset.THIS_MONTH -> Pair("01/09/2026", "30/09/2026")
            DatePreset.TODAY -> Pair("29/09/2026", "29/09/2026")
            DatePreset.THIS_WEEK -> Pair("22/09/2026", "29/09/2026")
            DatePreset.THIS_QUARTER -> Pair("01/07/2026", "30/09/2026")
            DatePreset.CUSTOM -> Pair(_uiState.value.filters.startDate, _uiState.value.filters.endDate)
        }

        _uiState.update { current ->
            current.copy(
                filters = current.filters.copy(
                    datePreset = preset,
                    startDate = start,
                    endDate = end
                )
            )
        }
        loadReport()
    }

    fun onStartDateChanged(date: String) {
        _uiState.update { current ->
            current.copy(
                filters = current.filters.copy(
                    startDate = date,
                    datePreset = DatePreset.CUSTOM
                )
            )
        }
        loadReport()
    }

    fun onEndDateChanged(date: String) {
        _uiState.update { current ->
            current.copy(
                filters = current.filters.copy(
                    endDate = date,
                    datePreset = DatePreset.CUSTOM
                )
            )
        }
        loadReport()
    }

    fun onFirmSelected(firmId: String) {
        _uiState.update { current ->
            current.copy(filters = current.filters.copy(firmId = firmId))
        }
        loadReport()
    }

    fun onGodownSelected(godownId: String) {
        _uiState.update { current ->
            current.copy(filters = current.filters.copy(godownId = godownId))
        }
        loadReport()
    }

    fun onCategorySelected(categoryId: String) {
        _uiState.update { current ->
            current.copy(filters = current.filters.copy(categoryId = categoryId))
        }
        loadReport()
    }

    fun onItemSelected(itemId: String) {
        _uiState.update { current ->
            current.copy(filters = current.filters.copy(itemId = itemId))
        }
        loadReport()
    }

    fun onSearchQueryChanged(query: String) {
        _uiState.update { current ->
            current.copy(filters = current.filters.copy(searchQuery = query))
        }
        loadReport()
    }

    fun onSortColumnToggled(column: SortColumnField) {
        _uiState.update { current ->
            current.copy(sortOrder = current.sortOrder.toggle(column))
        }
        loadReport()
    }

    fun onExportExcel() {
        val count = _uiState.value.items.size
        _uiState.update {
            it.copy(exportFeedbackMessage = "Exporting $count party records to Excel (.xlsx)...")
        }
    }

    fun onPrintPdf() {
        val count = _uiState.value.items.size
        _uiState.update {
            it.copy(exportFeedbackMessage = "Generating printable PDF report for $count records...")
        }
    }

    fun onDismissExportFeedback() {
        _uiState.update { it.copy(exportFeedbackMessage = null) }
    }
}
