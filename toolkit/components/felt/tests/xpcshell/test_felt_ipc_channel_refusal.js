/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Bug 2072053: when felt refuses the IPC peer, the one-shot endpoint is gone,
// so the spawned browser must be terminated rather than left starting with a
// released endpoint name that another process could claim.

const { openIpcChannelOrTerminate } = ChromeUtils.importESModule(
  "chrome://felt/content/FeltProcessParent.sys.mjs"
);

function fakeProc() {
  return {
    killedWith: [],
    kill(timeout) {
      this.killedWith.push(timeout);
      return Promise.resolve({ exitCode: -9 });
    },
  };
}

add_task(async function test_refused_peer_terminates_the_browser() {
  const proc = fakeProc();
  const refusal = new Error("refused");
  await Assert.rejects(
    openIpcChannelOrTerminate(proc, () => {
      throw refusal;
    }),
    e => e === refusal,
    "the refusal is rethrown for the launch failure path"
  );
  Assert.deepEqual(proc.killedWith, [0], "the browser is force-killed");
});

add_task(async function test_accepted_peer_leaves_the_browser_running() {
  const proc = fakeProc();
  let opened = false;
  await openIpcChannelOrTerminate(proc, () => {
    opened = true;
  });
  Assert.ok(opened, "the channel was opened");
  Assert.deepEqual(proc.killedWith, [], "the browser is not killed");
});
