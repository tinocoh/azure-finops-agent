# FinOps Strategy Feedback & Improvements

**Source:** Expert feedback from Session #3 review (Banedanmark / Microsoft)
**Date:** 1 April 2026
**Meeting duration:** 2h 18m 58s

---

## Revised FinOps Maturity Model

### CRAWL (Horizontal — Broad visibility)

| Area                 | Details                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Tagging**          | Required tags: `Department`, `Environment`, `Cost Center`. Success rate target: >80% coverage |
| **Budget & Alerts**  | Basic budget alerts per subscription                                                          |
| **Advisor**          | Review Azure Advisor cost recommendations                                                     |
| **Orphaned Objects** | Identify and clean up orphaned disks, IPs, NICs                                               |
| **Overview**         | All-up cost visibility across subscriptions                                                   |

> **Scope:** Crawl is **horizontal** — broad coverage across the entire estate.
> **Output:** Provide a list of findings. Task is to **review**, not fix.
> Out of scope at this stage: providing fixes or detailed remediation.

---

### WALK (Horizontal — Broad execution)

| Area                             | Details                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| **Reservations & Savings Plans** | Horizontal coverage — identify candidates across all subscriptions       |
| **Policy for Tagging**           | Enforce tagging via Azure Policy (audit → deny)                          |
| **Snoozing in Non-Prod**         | Suggest auto-shutdown / snoozing schedules for non-prod workloads        |
| **Right-sizing in Non-Prod**     | Low-hanging fruit — right-size over-provisioned non-prod resources first |
| **Legacy Cleanup**               | Clean up migrated subscriptions that carry lift-and-shift waste          |
| **Azure Hybrid Benefit (AHUB)**  | Apply existing Windows Server / SQL licenses to reduce VM costs          |

> **Scope:** Walk is still **horizontal** — executing optimizations broadly.
> **Decision:** Budget/Alert expansion — pause or continue? Revisit priority.

---

### RUN (Vertical — Per-department ownership)

| Area                           | Details                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| **Vertical Cost Optimization** | Establish FinOps practice per department / LoB / cost area              |
| **Dashboard-driven**           | Use dashboards to drive cost converregulated tenantions per department / cost center |
| **Cost avoidance**             | "Cost drive by not doing stuff" — avoid unnecessary spend proactively   |
| **Chargeback / Showback**      | Implement cost allocation model so teams own their spend                |
| **Move up the stack**          | Modernize workloads (PaaS, containers) — acknowledged as hard           |

> **Scope:** Run is **vertical** — scoped to specific teams/divisions who own their costs.
> Dashboards and reports must be visible to vertical team owners.

---

## Execution Strategy: Horizontal vs. Vertical

### Key Decision

> **Platform vs. LoB/Division — which axis drives execution?**

| Approach               | Description                                                 | When to use                                                       |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| **Horizontal (Broad)** | Execute across all subscriptions uniformly                  | Crawl & Walk phases — orphaned items, Advisor, AHUB, Reservations |
| **Vertical (Scoped)**  | Set scope per LoB / Subscription / Cost Center / Department | Run phase — ownership = scope, small scope first                  |

### Vertical Scoping Guidance

1. Choose scope: Subscriptions, Cost Center, Department, or Division
2. Start with a **small scope** — prove value before expanding
3. Define **what is prod vs. non-prod** within each scope
4. Apply non-prod specific optimizations: snoozing, right-sizing, AHUB
5. Assign **ownership** — scope = ejerskab (ownership)

---

## Output & Reporting Requirements

### What to show leadership / LoB owners

| Report                       | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| **Potential savings**        | Show total optimization potential to Leadership / LoB owners      |
| **Lost potential over time** | Show cost that could have been saved but wasn't — creates urgency |
| **Lifetime potential**       | Show cumulative savings potential over the life of the resources  |

### Action tracking

| Element                   | Approach                                                            |
| ------------------------- | ------------------------------------------------------------------- |
| **Clear actions**         | Each finding must have an explicit action or exception              |
| **Exceptions**            | If an action is deferred, document the exception with a review date |
| **Fix = separate action** | "How to fix" is a separate workstream from the review/assessment    |

---

## Key Takeaways

1. **Crawl = Horizontal, Walk = Horizontal, Run = Vertical** — this is the execution axis progression
2. **Review first, fix separately** — don't conflate assessment with remediation
3. **Small scope first** in vertical execution — prove value, then expand
4. **Show lost potential** — the cost of inaction is a powerful motivator for leadership buy-in
5. **Non-prod is the starting point** for right-sizing and snoozing — lower risk, quick wins
6. **Legacy migrated subscriptions** carry hidden waste — prioritize cleanup in Walk phase
7. **Ownership = Scope** — vertical execution only works when someone owns the cost area
