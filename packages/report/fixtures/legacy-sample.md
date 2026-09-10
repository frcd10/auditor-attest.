# Example Program — Security Audit Report

| Field | Value |
|---|---|
| **Repository** | example-org/example-program |
| **Commit** | `abcdef0123456789abcdef0123456789abcdef01` |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

### Repository Risk Score: 10 / 10 (Critical — do not deploy)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 1 |
| High (7-8) | 1 |
| Medium (4-6) | 1 |
| Low (1-3) | 1 |
| **Total** | **4** |

---

## 2. Confirmed Findings

### EX-01 — Withdraw accounting mismatch drains recipients
- **Severity:** 10/10 — Critical
- **Category:** Economic logic
- **Location:** `src/withdraw.rs:98`

The withdraw handler advances `withdrawn` by `available` instead of `requested`.

### [HIGH] EX-02 — Missing signer check on admin path
- **Severity:** 4 (High)
- **Location:** `src/admin.rs:12`

Anyone can call `set_admin`.

### EX-03 — Rounding favours the caller

| Field | Value |
|---|---|
| **Severity** | Medium (4 / 10) |
| **Location** | `src/math.rs:44` |

Division truncates toward the user.

### EX-04 — Missing event on pause
- **Severity:** 2 / 10 — Low

No event is emitted.

---

## 3. Unconfirmed / Informational Candidates

### EX-U1 — Possible oracle staleness
- **Severity:** 7/10 — High (unconfirmed, needs runtime check)

Could not be confirmed statically.

## 4. Coverage & Methodology

Files read: all of `src/`.
