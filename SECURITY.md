# SafeSeed security policy

## Supported version

Security fixes target the latest published SafeSeed release. Check the
[GitHub Releases](https://github.com/advokat-frida/safeseed/releases) page or
the [`safeseed` npm package](https://www.npmjs.com/package/safeseed) for the current version.
Older releases may receive a fix when the risk is severe and the repair is practical, but that is
best effort rather than a support promise.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/advokat-frida/safeseed/security/advisories/new).
Do not open a public issue for a suspected vulnerability.

Please include:

- the affected SafeSeed version or full Action commit SHA;
- the command, Action inputs, or minimal fixture needed to reproduce the behavior;
- the security impact and what an attacker must control;
- whether the issue affects the CLI, library, generator, run record, reserved-range catalog, or
  GitHub Action; and
- a proposed fix, if you have one.

Do not attach production data, credentials, or real personal information. A structurally fake
reproducer is enough. Reports are reviewed as maintainer capacity allows; SafeSeed does not offer
a response-time SLA.

## Action security model

The tagged GitHub Action runs the CLI bytes committed in the same release:

- no package or script is downloaded at runtime;
- no shell evaluates workflow inputs;
- no network request, telemetry, account, secret, or `GITHUB_TOKEN` access is required;
- only the `data` and `record` paths supplied by the workflow are read;
- the wrapper terminates verification after five minutes rather than allowing an unbounded child
  process; and
- GitHub's managed Node 24 Action runtime executes the wrapper on Linux, Windows, or macOS.

The Action still runs inside the caller's job and therefore shares that job's ambient access. Use
the least-privileged workflow permissions you can, avoid placing unnecessary secrets in the same
job, and pin third-party actions to full commit SHAs when your threat model requires immutability.

## Security-sensitive changes

Changes to `action.yml`, `action/`, `dist/`, the reserved-range catalog, verification logic, or
release workflows should receive the same scrutiny as executable release code. A green unit-test
run is necessary but not sufficient: rebuild and compare the committed Action bytes, run the
consumer Action contract, inspect the package dry run, and review the final tag before publication.
