# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** example-org/example-vault  
**Commit:** 0123456  
**Branch:** main  
**Date:** 2026-09-02  
**Auditor:** auditor-skill v7.3  
**Scope:** PROGRAM  
**Languages Detected:** Rust  
**Repository Risk Score:** 8 — HIGH

### What We Found

The vault program is small and mostly well-guarded. One High and one Medium finding.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 1 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 0 |
| 5 | 🟡 MEDIUM | 1 |
| 4 | 🔵 LOW | 0 |
| 3 | 🔵 LOW | 0 |
| 2 | ⚪ INFO | 0 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **2** |

---

## 4. Findings

#### [F-001] Fee accrual can overflow

| Field | Value |
|---|---|
| **Severity** | 8 — 🟠 HIGH |
| **Checklist Item** | 03-012 |
| **Category** | Arithmetic |
| **Language** | Rust |
| **File** | programs/vault/src/state.rs:88 |
| **Status** | Open |

**Description:**  
Unchecked multiplication.

---

#### [F-002] Pause flag not enforced on withdraw

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | 05-004 |
| **Category** | State Machine |
| **Language** | Rust |
| **File** | programs/vault/src/instructions/withdraw.rs:12 |
| **Status** | Open |

**Description:**  
Withdraw ignores `paused`.

---

### Findings by Severity (10 → 4)

#### Severity 8 — 🟠 HIGH
- [F-001] Fee accrual can overflow

#### Severity 5 — 🟡 MEDIUM
- [F-002] Pause flag not enforced on withdraw

---

## 5. Detailed Item Results

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated | 910 |
| PASS | 880 (96.7%) |
| FAIL | 2 (0.2%) |
| PARTIAL | 8 (0.9%) |
| N/A | 20 (2.2%) |
| **Pass rate** (excl. N/A) | **98.9%** |
| Highest severity found | 8 |
| Repository Risk Score | **8** |
