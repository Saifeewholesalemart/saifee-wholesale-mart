package com.saifee.reports.partyitem.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saifee.reports.partyitem.presentation.components.ReportRowItem
import com.saifee.reports.partyitem.presentation.components.ReportStickyFooter
import com.saifee.reports.partyitem.presentation.components.ReportTableHeader
import com.saifee.reports.partyitem.presentation.components.ReportTopFilterBar

/**
 * Production-ready single-screen responsive report dashboard for "Party Report By Item".
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartyItemReportScreen(
    viewModel: PartyItemReportViewModel = viewModel(),
    onNavigateBack: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val horizontalTableScrollState = rememberScrollState()

    LaunchedEffect(uiState.exportFeedbackMessage) {
        uiState.exportFeedbackMessage?.let { message ->
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
            viewModel.onDismissExportFeedback()
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Party Report By Item",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = "Sales & Purchase Analysis by Party",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    } else {
                        Icon(
                            imageVector = Icons.Default.Assessment,
                            contentDescription = "Reports",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 12.dp)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadReport() }) {
                        Icon(imageVector = Icons.Default.Refresh, contentDescription = "Refresh data")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF1F5F9)) // Clean modern slate background
        ) {
            // Top Filter Bar Section
            ReportTopFilterBar(
                filters = uiState.filters,
                firmOptions = uiState.firmOptions,
                godownOptions = uiState.godownOptions,
                categoryOptions = uiState.categoryOptions,
                itemOptions = uiState.itemOptions,
                onDatePresetSelected = viewModel::onDatePresetSelected,
                onStartDateChanged = viewModel::onStartDateChanged,
                onEndDateChanged = viewModel::onEndDateChanged,
                onFirmSelected = viewModel::onFirmSelected,
                onGodownSelected = viewModel::onGodownSelected,
                onCategorySelected = viewModel::onCategorySelected,
                onItemSelected = viewModel::onItemSelected,
                onSearchQueryChanged = viewModel::onSearchQueryChanged,
                onExportExcel = viewModel::onExportExcel,
                onPrintPdf = viewModel::onPrintPdf,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
            )

            // Content Body Section
            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                            Text(
                                text = "Calculating party aggregates...",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF64748B)
                            )
                        }
                    }
                }

                uiState.errorMessage != null -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "⚠️ ${uiState.errorMessage}",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center
                            )
                            Button(onClick = { viewModel.loadReport() }) {
                                Text("Retry Loading")
                            }
                        }
                    }
                }

                uiState.items.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.SearchOff,
                                contentDescription = "No items",
                                tint = Color(0xFF94A3B8),
                                modifier = Modifier.size(48.dp)
                            )
                            Text(
                                text = "No party records found",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF334155)
                            )
                            Text(
                                text = "Try adjusting your search term, date range, or category filter.",
                                fontSize = 12.sp,
                                color = Color(0xFF64748B),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                else -> {
                    // Data Grid with Horizontal Scroll + Sticky Header + Sticky Footer
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        shadowElevation = 2.dp
                    ) {
                        Column(modifier = Modifier.fillMaxSize()) {
                            // Horizontally Scrollable Table Container
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f)
                                    .horizontalScroll(horizontalTableScrollState)
                            ) {
                                Column(modifier = Modifier.width(800.dp)) {
                                    // 1. Sticky Table Header
                                    ReportTableHeader(
                                        sortOrder = uiState.sortOrder,
                                        onSortColumnToggled = viewModel::onSortColumnToggled
                                    )
                                    HorizontalDivider(color = Color(0xFFCBD5E1), thickness = 1.dp)

                                    // 2. Scrollable Rows List
                                    LazyColumn(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .weight(1f)
                                    ) {
                                        itemsIndexed(
                                            items = uiState.items,
                                            key = { _, item -> item.id }
                                        ) { index, item ->
                                            ReportRowItem(
                                                item = item,
                                                isEvenRow = index % 2 == 0
                                            )
                                            HorizontalDivider(color = Color(0xFFF1F5F9), thickness = 0.5.dp)
                                        }
                                    }

                                    // 3. Sticky Bottom Summary Footer
                                    HorizontalDivider(color = Color(0xFF334155), thickness = 1.5.dp)
                                    ReportStickyFooter(summary = uiState.summary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
