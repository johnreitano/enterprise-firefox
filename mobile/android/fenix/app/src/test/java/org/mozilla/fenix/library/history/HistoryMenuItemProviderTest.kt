/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.library.history

import kotlin.test.assertEquals
import mozilla.components.compose.base.text.Text
import mozilla.components.compose.menu.data.StandardMenuItem
import mozilla.components.compose.menu.ui.MenuItemIconRes
import mozilla.components.ui.icons.R as iconsR
import org.junit.Test
import org.mozilla.fenix.R
import org.mozilla.fenix.components.menu.store.MenuAction

class HistoryMenuItemProviderTest {
    @Test
    fun `WHEN building the menu item THEN provide the item for opening the history screen`() {
        val provider = HistoryMenuItemProvider()

        assertEquals(
            StandardMenuItem(
                title = Text.Resource(R.string.library_history),
                icon = MenuItemIconRes(iconsR.drawable.mozac_ic_history_24),
                onClickEvent = MenuAction.Navigate.History,
            ),
            provider.itemFlow.value,
        )
    }
}
