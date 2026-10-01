package com.saifee.reports.partyitem.data.datasource

import com.saifee.reports.partyitem.domain.model.FilterOption
import com.saifee.reports.partyitem.domain.model.PartyReportItem

/**
 * Mock data source providing realistic party reports by item data for FMCG & wholesale distribution.
 */
class PartyItemMockDataSource {

    fun getFirms(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Firms"),
        FilterOption("FIRM-01", "Saifee General Stores (Main)"),
        FilterOption("FIRM-02", "Burhani Trading Agency"),
        FilterOption("FIRM-03", "Al-Hasan Wholesale Depot")
    )

    fun getGodowns(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Godowns"),
        FilterOption("GDN-01", "Central Godown - Indore Hub"),
        FilterOption("GDN-02", "Ujjain Road Storage Hub"),
        FilterOption("GDN-03", "Depot Yard 2 (Loose Stock)")
    )

    fun getCategories(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Categories"),
        FilterOption("CAT-01", "Biscuits & Bakery"),
        FilterOption("CAT-02", "Personal Care & Soaps"),
        FilterOption("CAT-03", "Edible Oils & Ghee"),
        FilterOption("CAT-04", "Confectionery & Chocolates"),
        FilterOption("CAT-05", "Beverages & Tea")
    )

    fun getItems(): List<FilterOption> = listOf(
        FilterOption("ALL", "All Items"),
        FilterOption("PRD-01", "Parle-G Gold 100g (Carton 24 Pcs)"),
        FilterOption("PRD-02", "Britannia Good Day Butter 75g (48 Pcs)"),
        FilterOption("PRD-03", "Lux Rose Glow Beauty Soap 100g (36 Pcs)"),
        FilterOption("PRD-04", "Riya Melody Perfume Spray 150ml (12 Pcs)"),
        FilterOption("PRD-05", "Fortune Sunlite Refined Sunflower Oil 1L (15 Pouches)"),
        FilterOption("PRD-06", "Tata Tea Gold Leaf 500g (20 Pks)")
    )

    fun getSamplePartyReportItems(): List<PartyReportItem> = listOf(
        PartyReportItem(
            id = "PRT-001",
            srNo = 1,
            partyName = "Aadinath enterprise ratlam",
            saleQtyBase = 1628L,
            saleQtyLoose = 16L,
            saleAmount = 184520.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-002",
            srNo = 2,
            partyName = "Aashirwaad collection khachrod B3",
            saleQtyBase = 840L,
            saleQtyLoose = 12L,
            saleAmount = 98700.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-003",
            srNo = 3,
            partyName = "Balaji Super Market Nagda",
            saleQtyBase = 2450L,
            saleQtyLoose = 0L,
            saleAmount = 269500.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-004",
            srNo = 4,
            partyName = "Britannia Industries Ltd (Depot)",
            saleQtyBase = 0L,
            saleQtyLoose = 0L,
            saleAmount = 0.00,
            purchaseQtyBase = 10554L,
            purchaseQtyLoose = 272L,
            purchaseAmount = 1145890.00
        ),
        PartyReportItem(
            id = "PRT-005",
            srNo = 5,
            partyName = "Chamunda Kirana & Provision Stores",
            saleQtyBase = 620L,
            saleQtyLoose = 8L,
            saleAmount = 72400.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-006",
            srNo = 6,
            partyName = "Deepak Traders Jaora",
            saleQtyBase = 1180L,
            saleQtyLoose = 24L,
            saleAmount = 135700.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-007",
            srNo = 7,
            partyName = "Hindustan Unilever Depot Indore",
            saleQtyBase = 0L,
            saleQtyLoose = 0L,
            saleAmount = 0.00,
            purchaseQtyBase = 6420L,
            purchaseQtyLoose = 180L,
            purchaseAmount = 748300.00
        ),
        PartyReportItem(
            id = "PRT-008",
            srNo = 8,
            partyName = "Jain Mega Mart Mahidpur Road",
            saleQtyBase = 1950L,
            saleQtyLoose = 0L,
            saleAmount = 214500.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-009",
            srNo = 9,
            partyName = "Kothari Brothers Ratlam Station",
            saleQtyBase = 530L,
            saleQtyLoose = 14L,
            saleAmount = 61250.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-010",
            srNo = 10,
            partyName = "Mahalaxmi Daily Needs Badnagar",
            saleQtyBase = 780L,
            saleQtyLoose = 6L,
            saleAmount = 89200.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        ),
        PartyReportItem(
            id = "PRT-011",
            srNo = 11,
            partyName = "Parle Products Pvt Ltd Mumbai",
            saleQtyBase = 0L,
            saleQtyLoose = 0L,
            saleAmount = 0.00,
            purchaseQtyBase = 8900L,
            purchaseQtyLoose = 120L,
            purchaseAmount = 890000.00
        ),
        PartyReportItem(
            id = "PRT-012",
            srNo = 12,
            partyName = "Shree Ganesh Retail Point Ujjain",
            saleQtyBase = 1420L,
            saleQtyLoose = 30L,
            saleAmount = 164800.00,
            purchaseQtyBase = 0L,
            purchaseQtyLoose = 0L,
            purchaseAmount = 0.00
        )
    )
}
