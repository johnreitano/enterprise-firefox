#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

import json
import os
import sys

sys.path.append(os.path.dirname(__file__))

from felt_relaunch_deadline import WARNING_ID, BrowserRelaunchDeadlineBase


class BrowserRelaunchDeadlineFirstPoll(BrowserRelaunchDeadlineBase):
    def test_relaunch_deadline_armed_by_the_first_poll(self):
        # The console already asks for a restart before the browser starts, so
        # the deadline is armed by the poll that runs at "policies-startup" --
        # ahead of the phase the warning UI delegate registers from. The other
        # relaunch tests all serve the directive to an already-running browser.
        self.relaunch.value = json.dumps({"MinutesRemaining": 45})

        self.run_felt_base()
        self.connect_child_browser()

        assert self.wait_for_relaunch_bar() == WARNING_ID, (
            "The warning bar never appeared for a deadline armed at startup"
        )
        self.assert_relaunch_message(
            "enterprise-relaunch-warning-message", "will restart at"
        )

    def test_relaunch_deadline_armed_by_the_first_poll_escalates(self):
        # Same startup race, but the budget is already inside the imminent
        # threshold, so the first delegated update is the countdown.
        self.relaunch.value = json.dumps({
            "MinutesRemaining": 4,
            "GracePeriodMinutes": 0,
        })

        self.run_felt_base()
        self.connect_child_browser()

        self.assert_relaunch_message(
            "enterprise-relaunch-imminent-message", "will restart in"
        )
