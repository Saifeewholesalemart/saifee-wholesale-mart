package com.saifee.reports.partyitem.data.datasource

import com.saifee.reports.partyitem.domain.model.FilterOption
import com.saifee.reports.partyitem.domain.model.PartyReportItem

/**
 * Mock data source providing realistic item reports by party data for FMCG & wholesale distribution.
 */
class PartyItemMockDataSource {

    fun getFirms(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Companies / Firms"),
        FilterOption("FIRM-01", "Saifee General Stores (Main)"),
        FilterOption("FIRM-02", "Saifee Wholesale Mart"),
        FilterOption("FIRM-03", "Saifee Trading Depot")
    )

    fun getGodowns(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Godowns"),
        FilterOption("GDN-01", "Main Godown (Indore Hub)"),
        FilterOption("GDN-02", "Branch Godown (Sanwer Road)"),
        FilterOption("GDN-03", "Depot Yard 2 (Loose Stock)")
    )

    fun getCategories(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Categories"),
        FilterOption("CAT-01", "Agrochemicals & Crop Care"),
        FilterOption("CAT-02", "Biscuits & Bakery"),
        FilterOption("CAT-03", "Personal Care & Soaps"),
        FilterOption("CAT-04", "Edible Oils & Ghee"),
        FilterOption("CAT-05", "Beverages & Tea")
    )

    fun getItems(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Items"),
        FilterOption("PRD-01", "Coragen 250ml (Box)"),
        FilterOption("PRD-02", "Parle Cookies 300g (Carton)"),
        FilterOption("PRD-03", "Britannia Good Day Butter 75g (48 Pcs)"),
        FilterOption("PRD-04", "Lux Rose Glow Beauty Soap 100g (36 Pcs)"),
        FilterOption("PRD-05", "Fortune Sunlite Refined Sunflower Oil 1L (15 Pouches)"),
        FilterOption("PRD-06", "Tata Tea Gold Leaf 500g (20 Pks)")
    )

    fun getSamplePartyReportItems(): List<PartyReportItem> = listOf(
        PartyReportItem(
            id = "PRD-001",
            srNo = 1,
            partyName = "Coragen 250ml",
            productName = "Coragen 250ml",
            brand = "FMC Corporation",
            packSize = "250ml",
            tradingUnit = "Box",
            saleQtyBase = 20L,
            saleQtyLoose = 0L,
            saleAmount = 19000.00,
            purchaseQtyBase = 50L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 42500.00,
            closingInventoryBase = 35L,
            closingInventoryLoose = 0L,
            closingInventoryDisplay = "35 Boxes"
        ),
        PartyReportItem(
            id = "PRD-002",
            srNo = 2,
            partyName = "Parle Cookies 300g",
            productName = "Parle Cookies 300g",
            brand = "Parle",
            packSize = "300g",
            tradingUnit = "Carton",
            saleQtyBase = 10L,
            saleQtyLoose = 0L,
            saleAmount = 12000.00,
            purchaseQtyBase = 20L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 18000.00,
            closingInventoryBase = 15L,
            closingInventoryLoose = 0L,
            closingInventoryDisplay = "15 Cartons"
        ),
        PartyReportItem(
            id = "PRD-003",
            srNo = 3,
            partyName = "Britannia Good Day Butter 75g",
            productName = "Britannia Good Day Butter 75g",
            brand = "Britannia",
            packSize = "75g (48 Pcs/Ctn)",
            tradingUnit = "Carton",
            saleQtyBase = 45L,
            saleQtyLoose = 12L,
            saleAmount = 56250.00,
            purchaseQtyBase = 80L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 88000.00,
            closingInventoryBase = 60L,
            closingInventoryLoose = 8L,
            closingInventoryDisplay = "60 Cartons + 8 Pcs"
        ),
        PartyReportItem(
            id = "PRD-004",
            srNo = 4,
            partyName = "Lux Rose Glow Beauty Soap 100g",
            productName = "Lux Rose Glow Beauty Soap 100g",
            brand = "HUL",
            packSize = "100g (36 Pcs/Box)",
            tradingUnit = "Box",
            saleQtyBase = 30L,
            saleQtyLoose = 0L,
            saleAmount = 34500.00,
            purchaseQtyBase = 50L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 51000.00,
            closingInventoryBase = 40L,
            closingInventoryLoose = 0L,
            closingInventoryDisplay = "40 Boxes"
        ),
        PartyReportItem(
            id = "PRD-005",
            srNo = 5,
            partyName = "Tata Tea Gold Leaf 500g",
            productName = "Tata Tea Gold Leaf 500g",
            brand = "Tata Consumer",
            packSize = "500g (20 Pks/Ctn)",
            tradingUnit = "Carton",
            saleQtyBase = 25L,
            saleQtyLoose = 4L,
            saleAmount = 38750.00,
            purchaseQtyBase = 40L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 54000.00,
            closingInventoryBase = 22L,
            closingInventoryLoose = 10L,
            closingInventoryDisplay = "22 Cartons + 10 Pcs"
        )
    )
}
