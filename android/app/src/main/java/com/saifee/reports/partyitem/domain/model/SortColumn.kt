package com.saifee.reports.partyitem.domain.model

enum class SortDirection {
    ASCENDING,
    DESCENDING
}

enum class SortColumnField(val label: String) {
    SR_NO("#"),
    PARTY_NAME("PARTY NAME"),
    SALE_QTY("SALE QUANTITY"),
    SALE_AMOUNT("SALE AMOUNT"),
    PURCHASE_QTY("PURCHASE QUANTITY"),
    PURCHASE_AMOUNT("PURCHASE AMOUNT")
}

data class SortOrder(
    val column: SortColumnField = SortColumnField.SR_NO,
    val direction: SortDirection = SortDirection.ASCENDING
) {
    fun toggle(targetColumn: SortColumnField): SortOrder {
        return if (column == targetColumn) {
            copy(
                direction = if (direction == SortDirection.ASCENDING) {
                    SortDirection.DESCENDING
                } else {
                    SortDirection.ASCENDING
                }
            )
        } else {
            SortOrder(column = targetColumn, direction = SortDirection.ASCENDING)
        }
    }
}
