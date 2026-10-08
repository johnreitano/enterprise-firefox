/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.components.menu.fake

import kotlin.test.assertEquals
import mozilla.components.compose.base.text.Text
import mozilla.components.compose.menu.data.ExpandableMenuItem
import mozilla.components.compose.menu.data.MenuItemActionButton
import mozilla.components.compose.menu.data.StandardMenuItem
import mozilla.components.compose.menu.store.MenuEvent
import org.junit.Test

class MenuItemEventsTest {
    @Test
    fun `WHEN getting the events of an item THEN include all the events the item and action buttons can dispatch`() {
        val item =
            StandardMenuItem(
                title = Text.String("Item"),
                onClickEvent = TestEvent("click"),
                onShownEvent = TestEvent("shown"),
                onLongClickEvent = TestEvent("long click"),
                actionButton =
                    MenuItemActionButton(
                        icon = 0,
                        contentDescription = Text.String("Action"),
                        onClickEvent = TestEvent("action"),
                    ),
            )

        assertEquals(
            listOf(TestEvent("click"), TestEvent("long click"), TestEvent("shown"), TestEvent("action")),
            item.reachableEvents(),
        )
    }

    @Test
    fun `WHEN getting the events of an item expanding to others THEN include the events of those items`() {
        val item =
            ExpandableMenuItem(
                title = Text.String("More"),
                onClickEvent = TestEvent("expand"),
                onLongClickEvent = TestEvent("long click"),
                subMenuItems = listOf(StandardMenuItem(title = Text.String("Item"), onClickEvent = TestEvent("click"))),
            )

        assertEquals(
            listOf(TestEvent("expand"), TestEvent("long click"), TestEvent("click")),
            item.reachableEvents(),
        )
    }

    @Test
    fun `GIVEN an item dispatching only when clicked WHEN getting its events THEN include only that one`() {
        val item = StandardMenuItem(title = Text.String("Item"), onClickEvent = TestEvent("click"))

        assertEquals(listOf<MenuEvent>(TestEvent("click")), item.reachableEvents())
    }

    private data class TestEvent(val name: String) : MenuEvent
}
