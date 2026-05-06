#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

# Reads the enterprise-console API token out of the Taskcluster secrets service
# through the task's proxy and hands it to enterprise-end2end.py in the
# environment, so it never reaches a command line or an on-disk file.
#
# Keeps xtrace off throughout, including when the caller turned it on: tracing
# the assignment below would print the token into the task log.

set +x
set -eu
set -o pipefail

: "${TASKCLUSTER_PROXY_URL:?the task needs taskcluster-proxy to read the API token}"
: "${MOZ_SCM_LEVEL:?}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
secret="project/enterprise/level-${MOZ_SCM_LEVEL}/enterprise-console-backend-apitoken"

GITHUB_TOKEN="$(
    curl --fail --silent --show-error --retry 5 --retry-all-errors \
        "${TASKCLUSTER_PROXY_URL%/}/secrets/v1/secret/${secret}" |
        python3 -c 'import json, sys; print(json.load(sys.stdin)["secret"]["content"])'
)"
export GITHUB_TOKEN

exec python3 -u "${script_dir}/enterprise-end2end.py" "$@"
