/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const { AddonTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/AddonTestUtils.sys.mjs"
);
const { AddonManager } = ChromeUtils.importESModule(
  "resource://gre/modules/AddonManager.sys.mjs"
);
const { PolicyFailures } = ChromeUtils.importESModule(
  "resource://gre/modules/PoliciesHelpers.sys.mjs"
);
const { setTimeout } = ChromeUtils.importESModule(
  "resource://gre/modules/Timer.sys.mjs"
);

AddonTestUtils.init(this);
AddonTestUtils.overrideCertDB();
AddonTestUtils.appInfo = getAppInfo();

const server = AddonTestUtils.createHttpServer({ hosts: ["example.com"] });
const BASE_URL = "http://example.com/data";
const ADDON_ID = "uninstall-policy@tests.mozilla.org";
const UNINSTALL_MARKER =
  "browser.policies.runOncePerModification.extensionsUninstall";
const INSTALL_MARKER =
  "browser.policies.runOncePerModification.extensionsInstall";

// Served from the update URL the test add-on carries.
const updates = [];

function createXPI(version) {
  return AddonTestUtils.createTempWebExtensionFile({
    manifest: {
      version,
      browser_specific_settings: {
        gecko: { id: ADDON_ID, update_url: `${BASE_URL}/update.json` },
      },
    },
  });
}

add_setup(async function () {
  Services.prefs.setBoolPref("extensions.checkUpdateSecurity", false);
  Services.prefs.setBoolPref("extensions.install.requireSecureOrigin", false);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("extensions.checkUpdateSecurity");
    Services.prefs.clearUserPref("extensions.install.requireSecureOrigin");
  });
  await AddonTestUtils.promiseStartupManager();
  server.registerFile("/data/v1.xpi", createXPI("1.0"));
  server.registerFile("/data/v2.xpi", createXPI("2.0"));
  server.registerPathHandler("/data/update.json", (request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.write(JSON.stringify({ addons: { [ADDON_ID]: { updates } } }));
  });
});

function applyPolicies(policies) {
  return setupPolicyEngineWithJson({ policies });
}

async function installOutsidePolicy() {
  await AddonTestUtils.promiseInstallFile(createXPI("1.0"));
  const addon = await AddonManager.getAddonByID(ADDON_ID);
  notEqual(addon, null, "The add-on is installed outside of policy");
  return addon;
}

async function ensureAbsent() {
  const addon = await AddonManager.getAddonByID(ADDON_ID);
  if (addon) {
    const uninstalled = AddonTestUtils.promiseAddonEvent("onUninstalled");
    await addon.uninstall();
    await uninstalled;
  }
}

// The Uninstall and Install steps of the Extensions policy keep running after
// the engine reports the policies applied; give them time to finish.
async function settle() {
  await AddonManager.getAddonsByIDs([ADDON_ID]);
  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(resolve => setTimeout(resolve, 250));
}

function watchAddonChanges() {
  const seen = [];
  const addonListener = {
    onUninstalling(addon) {
      if (addon.id == ADDON_ID) {
        seen.push("onUninstalling");
      }
    },
    onUninstalled(addon) {
      if (addon.id == ADDON_ID) {
        seen.push("onUninstalled");
      }
    },
  };
  const installListener = {
    onNewInstall() {
      seen.push("onNewInstall");
    },
  };
  AddonManager.addAddonListener(addonListener);
  AddonManager.addInstallListener(installListener);
  return {
    seen,
    stop() {
      AddonManager.removeAddonListener(addonListener);
      AddonManager.removeInstallListener(installListener);
    },
  };
}

add_task(async function test_preseeded_marker_does_not_suppress_uninstall() {
  EnterprisePolicyTesting.resetRunOnceState();
  await installOutsidePolicy();
  Services.prefs.setStringPref(UNINSTALL_MARKER, JSON.stringify([ADDON_ID]));

  const uninstalled = AddonTestUtils.promiseAddonEvent("onUninstalled");
  await applyPolicies({ Extensions: { Uninstall: [ADDON_ID] } });
  await uninstalled;

  equal(
    await AddonManager.getAddonByID(ADDON_ID),
    null,
    "The add-on was uninstalled despite the pre-seeded marker"
  );
});

add_task(async function test_uninstall_is_reapplied_after_a_reinstall() {
  equal(
    Services.prefs.getStringPref(UNINSTALL_MARKER),
    JSON.stringify([ADDON_ID]),
    "The marker matches the list applied by the previous task"
  );
  await installOutsidePolicy();

  const uninstalled = AddonTestUtils.promiseAddonEvent("onUninstalled");
  await applyPolicies({ Extensions: { Uninstall: [ADDON_ID] } });
  await uninstalled;

  equal(
    await AddonManager.getAddonByID(ADDON_ID),
    null,
    "The add-on was uninstalled again although the list is unchanged"
  );
});

add_task(
  async function test_forbidden_addon_removed_with_both_markers_seeded() {
    EnterprisePolicyTesting.resetRunOnceState();
    await installOutsidePolicy();
    Services.prefs.setStringPref(UNINSTALL_MARKER, JSON.stringify([ADDON_ID]));
    Services.prefs.setStringPref(
      INSTALL_MARKER,
      JSON.stringify([`${BASE_URL}/v2.xpi`])
    );

    const uninstalled = AddonTestUtils.promiseAddonEvent("onUninstalled");
    await applyPolicies({
      Extensions: { Uninstall: [ADDON_ID], Install: [`${BASE_URL}/v2.xpi`] },
    });
    await uninstalled;
    await settle();

    equal(
      await AddonManager.getAddonByID(ADDON_ID),
      null,
      "The add-on installed outside of policy was uninstalled"
    );
  }
);

add_task(
  async function test_policy_installed_addon_kept_while_lists_unchanged() {
    EnterprisePolicyTesting.resetRunOnceState();
    await ensureAbsent();
    const policies = {
      Extensions: { Uninstall: [ADDON_ID], Install: [`${BASE_URL}/v1.xpi`] },
    };

    const installed = AddonTestUtils.promiseInstallEvent("onInstallEnded");
    await applyPolicies(policies);
    await installed;
    let addon = await AddonManager.getAddonByID(ADDON_ID);
    equal(addon.version, "1.0", "The policy installed the add-on");
    equal(
      addon.installTelemetryInfo?.source,
      "enterprise-policy",
      "The add-on records the policy as its install source"
    );

    let watcher = watchAddonChanges();
    await applyPolicies(policies);
    await settle();
    watcher.stop();
    deepEqual(
      watcher.seen,
      [],
      "Re-applying the unchanged policy neither uninstalls nor installs"
    );
    addon = await AddonManager.getAddonByID(ADDON_ID);
    equal(addon?.version, "1.0", "The add-on is still installed");

    updates.push({ version: "2.0", update_link: `${BASE_URL}/v2.xpi` });
    const update = await AddonTestUtils.promiseFindAddonUpdates(addon);
    ok(update.updateAvailable, "An update was found through the update URL");
    await AddonTestUtils.promiseCompleteAllInstalls([update.updateAvailable]);
    updates.length = 0;
    addon = await AddonManager.getAddonByID(ADDON_ID);
    equal(addon.version, "2.0", "The add-on updated itself");
    equal(
      addon.sourceURI.spec,
      `${BASE_URL}/v2.xpi`,
      "The update replaced the source URL"
    );
    equal(
      addon.installTelemetryInfo?.source,
      "enterprise-policy",
      "The update kept the install source"
    );

    watcher = watchAddonChanges();
    await applyPolicies(policies);
    await settle();
    watcher.stop();
    deepEqual(watcher.seen, [], "The updated add-on is left alone");
    addon = await AddonManager.getAddonByID(ADDON_ID);
    equal(addon?.version, "2.0", "The updated add-on is still installed");
  }
);

add_task(async function test_changed_uninstall_list_reinstalls_from_new_url() {
  EnterprisePolicyTesting.resetRunOnceState();
  await ensureAbsent();

  let installed = AddonTestUtils.promiseInstallEvent("onInstallEnded");
  await applyPolicies({ Extensions: { Install: [`${BASE_URL}/v1.xpi`] } });
  await installed;
  let addon = await AddonManager.getAddonByID(ADDON_ID);
  equal(addon.version, "1.0", "The policy installed the add-on");

  const policies = {
    Extensions: { Uninstall: [ADDON_ID], Install: [`${BASE_URL}/v2.xpi`] },
  };
  const uninstalled = AddonTestUtils.promiseAddonEvent("onUninstalled");
  installed = AddonTestUtils.promiseInstallEvent("onInstallEnded");
  await applyPolicies(policies);
  await uninstalled;
  await installed;
  addon = await AddonManager.getAddonByID(ADDON_ID);
  equal(
    addon.version,
    "2.0",
    "Adding the add-on to Uninstall reinstalled it from the Install URL"
  );

  const watcher = watchAddonChanges();
  await applyPolicies(policies);
  await settle();
  watcher.stop();
  deepEqual(watcher.seen, [], "The reinstalled add-on is left alone");
  addon = await AddonManager.getAddonByID(ADDON_ID);
  equal(addon?.version, "2.0", "The reinstalled add-on is still installed");
});

add_task(
  async function test_preseeded_marker_does_not_freeze_install_updates() {
    EnterprisePolicyTesting.resetRunOnceState();
    await ensureAbsent();

    let installed = AddonTestUtils.promiseInstallEvent("onInstallEnded");
    await applyPolicies({ Extensions: { Install: [`${BASE_URL}/v1.xpi`] } });
    await installed;

    Services.prefs.setStringPref(UNINSTALL_MARKER, JSON.stringify([ADDON_ID]));
    installed = AddonTestUtils.promiseInstallEvent("onInstallEnded");
    await applyPolicies({
      Extensions: { Uninstall: [ADDON_ID], Install: [`${BASE_URL}/v2.xpi`] },
    });
    await installed;

    const addon = await AddonManager.getAddonByID(ADDON_ID);
    equal(
      addon.version,
      "2.0",
      "The changed Install URL was applied despite the pre-seeded marker"
    );
  }
);

add_task(async function test_extensionsettings_install_takes_precedence() {
  EnterprisePolicyTesting.resetRunOnceState();
  await ensureAbsent();
  await installOutsidePolicy();

  const watcher = watchAddonChanges();
  await applyPolicies({
    ExtensionSettings: {
      [ADDON_ID]: {
        installation_mode: "normal_installed",
        install_url: `${BASE_URL}/v1.xpi`,
      },
    },
    Extensions: { Uninstall: [ADDON_ID] },
  });
  await settle();
  watcher.stop();

  ok(
    !watcher.seen.includes("onUninstalling"),
    "The add-on ExtensionSettings installs is not uninstalled"
  );
  notEqual(
    await AddonManager.getAddonByID(ADDON_ID),
    null,
    "The add-on is still installed"
  );
  const failures = PolicyFailures.getAll().Extensions ?? [];
  equal(failures.length, 1, "The conflict is reported against Extensions");
  ok(
    failures[0].includes(ADDON_ID),
    `The failure names the add-on: ${failures[0]}`
  );
});

add_task(async function cleanup() {
  await applyPolicies({});
  await ensureAbsent();
  EnterprisePolicyTesting.resetRunOnceState();
  await AddonTestUtils.promiseShutdownManager();
});
