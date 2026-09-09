/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let { runOnce, runOncePerModification, clearRunOnceModification } =
  ChromeUtils.importESModule("resource://gre/modules/PoliciesHelpers.sys.mjs");

let runCount = 0;
function callback() {
  runCount++;
}

add_task(async function test_runonce_helper() {
  runOnce("test_action", callback);
  equal(runCount, 1, "Callback ran for the first time.");

  runOnce("test_action", callback);
  equal(runCount, 1, "Callback didn't run again.");
});

add_task(async function test_runOncePerModification_helper() {
  const marker = "browser.policies.runOncePerModification.test_modification";
  runCount = 0;

  await runOncePerModification("test_modification", "one", callback);
  equal(runCount, 1, "Callback ran for a new value.");
  equal(
    Services.prefs.getStringPref(marker),
    "one",
    "The applied value is recorded."
  );

  await runOncePerModification("test_modification", "one", callback);
  equal(runCount, 1, "Callback didn't run again for the same value.");

  await runOncePerModification("test_modification", "two", callback);
  equal(runCount, 2, "Callback ran again for a changed value.");

  await runOncePerModification("test_modification", 2, callback);
  equal(runCount, 3, "A non-string value is compared by its string form.");
  equal(
    Services.prefs.getStringPref(marker),
    "2",
    "The recorded value is the string form."
  );

  clearRunOnceModification("test_modification");
  ok(
    !Services.prefs.prefHasUserValue(marker),
    "Clearing removes the recorded value."
  );
  await runOncePerModification("test_modification", "2", callback);
  equal(runCount, 4, "Callback ran again after the record was cleared.");

  clearRunOnceModification("test_modification");
});
