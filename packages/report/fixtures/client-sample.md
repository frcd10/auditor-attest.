# Example Vault — Security Audit Report

|                       |                                                        |
| --------------------- | ------------------------------------------------------ |
| **Auditor**           | auditor-skill v7.3                                     |
| **Client**            | example-org                                            |
| **Protocol**          | Example Vault                                          |
| **Report Title**      | Vault Program Security Assessment                      |
| **Report Version**    | 1.0 — draft                                            |
| **Audit Window**      | 2026-09-01 → 2026-09-02                                |
| **Report Published**  | 2026-09-02                                             |
| **Classification**    | Public                                                 |

---

## 1. Executive Summary

auditor-skill was engaged by example-org to perform a security assessment of the
Example Vault program. The review covered 1 program / 1,842 lines over 1 day. The
assessment identified 5 findings: 1 Critical, 1 High, 1 Medium, 1 Low, and 1
Informational. The core accounting logic is sound; findings cluster around
access-control hardening and input validation.

### 1.1 Findings Summary by Severity

| Severity            | Count | Resolved | Acknowledged | Open |
| ------------------- | :---: | :------: | :----------: | :--: |
| 🔴 Critical         | 1     | 0        | 0            | 1    |
| 🟠 High             | 1     | 0        | 0            | 1    |
| 🟡 Medium           | 1     | 0        | 0            | 1    |
| 🔵 Low              | 1     | 0        | 0            | 1    |
| ⚪ Informational    | 1     | 0        | 0            | 1    |
| **Total**           | **5** | **0**    | **0**        | **5** |

### 1.2 Finding Lifecycle

| Severity            | Discovered | Confirmed | Resolved | Acknowledged | Open |
| ------------------- | :--------: | :-------: | :------: | :----------: | :--: |
| 🔴 Critical         | 2          | 1         | 0        | 0            | 1    |
| 🟠 High             | 1          | 1         | 0        | 0            | 1    |
| 🟡 Medium           | 1          | 1         | 0        | 0            | 1    |
| 🔵 Low              | 1          | 1         | 0        | 0            | 1    |
| ⚪ Informational    | 1          | 1         | 0        | 0            | 1    |
| **Total**           | **6**      | **5**     | **0**    | **0**        | **5** |

### 1.4 Key Takeaways

- Critical AUD-01 (permissionless vault drain) must be fixed before any deployment.
- The program's upgrade authority is a single EOA — recommend a multisig + timelock.
- Test coverage is strong for happy paths but thin on adversarial cases.

---

## 2. Scope & Engagement

### 2.1 Engagement Envelope

|                            |                                                   |
| -------------------------- | ------------------------------------------------- |
| **Audited Commit**         | `0123456789abcdef0123456789abcdef01234567`        |
| **Scope Size**             | 1,842 LoC                                         |

---

## 6. Findings

### 6.1 Findings Summary Table

| ID     | Title | Severity | Status |
| ------ | ----- | -------- | ------ |
| AUD-01 | Missing owner check allows draining any vault | 🔴 Critical | Open |
| AUD-02 | Unchecked arithmetic in fee accrual | 🟠 High     | Open |
| AUD-03 | Pause flag not enforced on withdraw | 🟡 Medium   | Open |
| AUD-04 | Missing event on authority transfer | 🔵 Low      | Open |
| AUD-05 | Redundant rent check | ⚪ Informational | Open |

---

### 6.2 Detailed Findings

#### AUD-01 — Missing owner check allows draining any vault

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Severity**   | 🔴 Critical (internal: 10)                                  |
| **Impact**     | High — total loss of all deposited funds                    |
| **Likelihood** | High — permissionless, no special state required            |
| **Status**     | Open                                                        |
| **Location**   | `programs/vault/src/instructions/withdraw.rs#L42` @ `0123456` |
| **Category**   | Access Control / Account Validation                         |

**Description**
The `withdraw` instruction never constrains the destination token account.

**Impact**
Any permissionless caller can drain every vault.

**Recommendation**
Add `has_one = authority`.

---

#### AUD-02 — Unchecked arithmetic in fee accrual

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Severity**   | 🟠 High (internal: 7)                                       |
| **Impact**     | Medium — bounded loss                                       |
| **Likelihood** | High                                                        |
| **Status**     | Open                                                        |
| **Location**   | `programs/vault/src/state.rs#L88` @ `0123456`               |
| **Category**   | Arithmetic                                                  |

**Description**
`fee += amount * bps / 10_000` uses unchecked math in release builds.

---

#### AUD-03 — Pause flag not enforced on withdraw

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Severity**   | 🟡 Medium (internal: 5)                                     |
| **Status**     | Open                                                        |
| **Location**   | `programs/vault/src/instructions/withdraw.rs#L12` @ `0123456` |
| **Category**   | State Machine                                               |

**Description**
The `paused` flag is checked on deposit but not on withdraw.

---

#### AUD-04 — Missing event on authority transfer

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Severity**   | 🔵 Low (internal: 3)                                        |
| **Status**     | Open                                                        |
| **Category**   | Monitoring                                                  |

**Description**
No event is emitted when `set_authority` succeeds.

---

#### AUD-05 — Redundant rent check

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Severity**   | ⚪ Informational (internal: 2)                               |
| **Status**     | Open                                                        |
| **Category**   | Code Quality                                                |

**Description**
Anchor already enforces rent exemption for `init` accounts.

---

## 7. Findings Summary Table

| ID     | Title | Severity | Impact | Likelihood | Status | Location |
| ------ | ----- | -------- | ------ | ---------- | ------ | -------- |
| AUD-01 | Missing owner check allows draining any vault | 🔴 Critical | High | High | Open | `withdraw.rs:42` |
| AUD-02 | Unchecked arithmetic in fee accrual | 🟠 High | Medium | High | Open | `state.rs:88` |
| AUD-03 | Pause flag not enforced on withdraw | 🟡 Medium | Medium | Medium | Open | `withdraw.rs:12` |
| AUD-04 | Missing event on authority transfer | 🔵 Low | Low | Low | Open | `authority.rs:5` |
| AUD-05 | Redundant rent check | ⚪ Informational | Low | Low | Open | `init.rs:9` |

---

## 9. Appendices

### 9.4 Disclaimer

This report reflects a point-in-time security assessment.
