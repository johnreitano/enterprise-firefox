/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.downloads

import kotlin.test.assertEquals
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import mozilla.components.compose.base.text.Text
import mozilla.components.compose.menu.data.StandardMenuItem
import mozilla.components.compose.menu.ui.MenuItemIconRes
import mozilla.components.ui.icons.R as iconsR
import org.junit.Test
import org.mozilla.fenix.R
import org.mozilla.fenix.components.AppStore
import org.mozilla.fenix.components.appstate.AppAction
import org.mozilla.fenix.components.appstate.AppState
import org.mozilla.fenix.components.appstate.SupportedMenuNotifications
import org.mozilla.fenix.components.menu.store.MenuAction

@OptIn(ExperimentalCoroutinesApi::class)
class DownloadsMenuItemProviderTest {
    @Test
    fun `GIVEN there are no downloads notifications WHEN building the downloads menu item THEN return a non-highlighted item`() =
        runTest {
            val appStore = AppStore(AppState(supportedMenuNotifications = emptySet()))
            val provider = DownloadsMenuItemProvider(appStore, this.backgroundScope)

            assertEquals(expectedItem(isHighlighted = false), provider.itemFlow.value)
        }

    @Test
    fun `GIVEN there are downloads notifications WHEN building the downloads menu item THEN return a highlighted item`() =
        runTest {
            val appStore = AppStore(AppState(supportedMenuNotifications = setOf(SupportedMenuNotifications.Downloads)))
            val provider = DownloadsMenuItemProvider(appStore, this.backgroundScope)

            assertEquals(expectedItem(isHighlighted = true), provider.itemFlow.value)
        }

    @Test
    fun `WHEN the downloads notifications status changes THEN update the downloads menu item`() = runTest {
        val appStore = AppStore(AppState(supportedMenuNotifications = emptySet()))
        val provider = DownloadsMenuItemProvider(appStore, this.backgroundScope)

        val collectJob = launch { provider.itemFlow.collect {} }

        assertEquals(expectedItem(isHighlighted = false), provider.itemFlow.value)

        appStore.dispatch(AppAction.MenuNotification.AddMenuNotification(SupportedMenuNotifications.Downloads))
        advanceUntilIdle()

        assertEquals(expectedItem(isHighlighted = true), provider.itemFlow.value)

        collectJob.cancel()
    }

    private fun expectedItem(isHighlighted: Boolean) =
        StandardMenuItem(
            title = Text.Resource(R.string.library_downloads),
            icon =
                MenuItemIconRes(
                    iconsR.drawable.mozac_ic_download_24,
                    isHighlighted = isHighlighted,
                ),
            onClickEvent = MenuAction.Navigate.Downloads,
        )
}
