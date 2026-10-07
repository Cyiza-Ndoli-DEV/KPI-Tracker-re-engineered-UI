# Pahappa KPI Tracker: re-engineered prototype

A clickable front-end prototype, styled as part of Pahappa HR (v3.0.0), of the simplified Goal & KPI setup. It runs on mock data with no backend; all state lives in memory and is saved in the browser's localStorage, so a page refresh keeps your changes.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev        # opens http://localhost:5173
```

`npm run build` produces a static site in `dist/` that can be hosted anywhere. Routing is hash-based, so no server configuration is needed.

To start the demo over from the original sample data, go to **Admin Settings → Reset demo data**.

## What changed from the old system

| Old system (use-case document) | Re-engineered prototype |
|---|---|
| Goals created again at org, department, team and individual level, each with its own % contribution | **Goals exist only at organization level.** Lower levels receive a share of the goal's **KPIs** |
| KPIs created separately for every goal at every level | KPIs are defined once on the org goal; departments, teams and people are allocated a share of them |
| Contribution % typed by hand | You type a **%** and the amount appears, or type an **amount** and the % appears. The running allocated/remaining total is always visible |
| Each goal has a weight in the cycle; sibling weights must add up to 100% | **No goal weights.** Each goal is tracked on its own as 100%; its KPIs share that 100% by weight |
| Several screens, visited one after another | **One-lane setup wizard**: Goal → KPIs → Departments → Teams → Individuals → Review & save |
| Numerical / Binary KPIs | **Sum**, **Average** and **Completion** (Fully / Partially with admin presets / Not achieved with a reason) |
| Fixed update schedule | No frequency: date picker (no future dates) + value. Sum KPIs add each new amount to what was achieved before. Progress rolls up instantly |

Kept from the old system: **review cycles** (create → activate → set up goals → end), thresholds (Below / Needs improvement / Meets / Exceeds), and HR as the source of departments and staff.

## Demo walkthrough (about 10 minutes)

1. **Dashboard**: FY 2026 cycle, goals on track and average goal progress, then the **organization goals table**: each goal at 100% with its KPIs as rows underneath (weight in the goal, achieved / target, progress, and how much each KPI adds to the goal). Also running KPIs, and department and team progress. The Goals & KPIs page uses the same table.
2. **Review Cycles**: the cycle lifecycle. *Start next cycle from this one* copies every goal, KPI and allocation into editable drafts.
3. **Goal Setup Wizard**: create a goal end-to-end without leaving the page.
   - Step 1: name, type, dates. No weight: the goal is tracked on its own as 100%.
   - Step 2: add KPIs (target, unit, period, weight in the goal; the KPI weights add up to 100%).
   - Step 3: tick departments and choose *Split equally / By percentage / Enter amounts*. Type 60% and the amount shows; go over 100% and Save is blocked with the field highlighted. Try *Copy this setup to other departments* and *Upload from Excel*.
   - Step 4: split each department's share across its teams. Departments without teams are skipped, and you can **create a team** right there.
   - Step 5: pick people from the HR staff list (searchable, multi-select).
   - Step 6: a full summary of everything set up (goal, KPIs, and who contributes at every level), with **Adjust** on each part to jump back and return to the review. Then save. Then **Set up the next goal**.
   - *Save as draft* works on every step, and work is also autosaved. **Drafts** reopen at the step you left.
4. **Goals** and **KPIs** are separate menu items.
   - **Goals**: one row per goal; expand it to see the KPIs attached to it, and expand a KPI to see its departments → teams → people with share, achieved / target and progress. *Expand all* opens everything.
   - **KPIs**: the organization KPI (*parent KPI*) and every share of it held by a department, team or person (*child KPIs*).
     - Without filters it shows the whole hierarchy, collapsible.
     - Filter by **Level** (all, organization, department, team, individual) and by **Owner** (any department, team or person), as well as by goal and type. A *Hierarchy* column then shows each share's parent chain (Pahappa › Sales › Team A › Brian).
     - The four level cards at the top act as quick filters.
   - **KPI share page** (click any row, or any name in an allocation tree):
     - a level badge, and *Child KPI of Team A* or *Child of Sales · parent of 4*;
     - target, share of the parent, achieved, still to do, contribution to the parent and last result;
     - *Where this KPI sits*: goal → organization KPI → department → team → this share → the shares below it;
     - tabs for the KPIs below (or siblings), progress, results and audit log;
     - the right actions for that level: Update, Add member, Edit shares, Remove.
     - Employees can open their own shares from **My KPIs**.
   - **Goal detail**: allocation tree (org → dept → team → person) with progress at every node; *Start running / Stop running*.
5. **KPI detail → Annual Revenue**:
   - **Add member** on Team B → see the current members with their shares and achievements → pick *Mark Ochieng* → *Equal* or *Custom* → preview before/after → save. Achievements are unchanged; only remaining targets move.
   - **Update** a person's result and watch Team, Sales and Pahappa progress change immediately.
   - **Restart / New target / Reset / Reuse**, *Period history*, *Update history* and the *Audit log*.
   - **Someone leaves**: *Remove* on Ivan's row (Team B), or *Admin Settings → Record a leaver or a move* for Sarah. Choose *Share equally*, *Hand over to one person* (a colleague or a replacement such as Mark) or *Leave unallocated*, and check the before/after table. What they achieved stays in the totals, and their target drops to what they achieved. On Average/Completion KPIs they simply stop counting, or a replacement takes over.
   - **Edit while running** (Admin):
     - *Edit KPI*: name, target (shares kept, targets recalculated in the same period), period end and weights. A KPI with no results can also be deleted.
     - *Edit shares*: on the organization, department or team row, re-split the percentages or add a department or team.
     - *Edit goal* and *Add KPI* on the goal page.
     - A reason is required for each change, and every change goes to the audit log.
6. **Switch role → Employee** (Sarah Nakato) → **My KPIs**: update a result. Older updates are locked after 30 days and show **Request edit**.
7. **Admin Settings**: Daniel's pending edit request → **Extend** → (as Admin, edit Daniel's update on the KPI's *Update history* tab) → **Revert**. Every step appears in the audit log with who granted access.
8. **Reports** (Admin, Department Head, Team Lead; a Department Head sees only their department). Choose an *as of* date and a department, then:
   - **Overview**: cards that link to the full information, goals and their KPIs, key findings (lowest KPI, unshared targets, Available for PIP, members who have not updated, people without KPIs), final scores by band, top performers, Available for PIP.
   - **Member ranking**: each person's KPI score, Org Fit score and final score, ranked by final score.
   - **Departments**, **Teams** and **Individuals**, each reported separately: rank, score, band, weakest KPI, last update. Click a row to see each KPI share.
   - **Update compliance**: results recorded per month, people with no result in 30 days, staff without KPIs, targets not fully shared, and edit-request outcomes.
   - **Export to Excel** (8 sheets) and **Print**. Employees keep the separate **Rankings** page.
9. **Rankings** (employees): the same ranking — KPI score, Org Fit score and final score.

## Scoring and set up

- Progress and scores are shown as small **coloured percentage circles** (green 90%+, blue 70%+, amber 50%+, red below 50%) instead of long progress bars.

- **Admin Settings → Set up** controls:
  - **performance bands**: labels, starting scores and colours, e.g. "Exceeds expectations 100% and above";
  - the **final-score weights** (KPI 70% / Org Fit 30% by default);
  - the **"Available for PIP"** threshold;
  - the edit window, partial-completion presets, the number of days after which someone counts as "has not updated", and the organization name.
- **Admin Settings → Org Fit scores** (read-only): each person's Organizational Fit score, which comes from supervisor and peer ratings (sample percentages in the prototype), with their KPI score and final score.
- **Member final score** = average of their own KPI achievements × KPI weight + Org Fit × Org Fit weight.
- **Team lead final score** = average of their team members' KPI scores × KPI weight + their own Org Fit × Org Fit weight.
- **A KPI's contribution to the goal** is its share of the goal's 100%, and goal progress = Σ (KPI achievement × contribution).
- **A KPI's type** is always the goal's type; it is preselected and locked.

## Reports

- **Filters:** as-of date, department, goal and KPI.
- **Overview cards** link to the full information.
- **Lists:**
  - **Available for PIP**: final score below the threshold;
  - **Members who have not updated**;
  - **People without KPIs**, named.
- **Departments / Teams / Individuals:** separate reports.
  - Each person shows their KPI score, Org Fit, final score and **weakest KPI**.
  - Each team has a **Full report** Excel export: members, target vs actual per KPI.
- **Individual report:** click **Report** on a person to see their KPIs, how they performed, how often they update, and every performance record. It can be exported to Excel.
- **Update compliance:**
  - KPI performance over time, filtered by KPI, level and owner;
  - results recorded over time (by day or week), filtered by department, KPI and dates.

## Sample data

- Pahappa: Sales (Team A, Team B), Customer Care (Team C), Finance and IT (no teams); 21 staff.
- **Increase Revenue** has two KPIs: *Annual Revenue* (70% of the goal), Sum, UGX 1B, and *New clients signed* (30% of the goal), Sum, 120 clients. Sales has 60% (UGX 600M), split UGX 300M each to Team A and Team B. The other 40% is **deliberately left unallocated** to show the remaining-value indicator.
- **Improve Customer Satisfaction**: Average, 70% → 84%. Includes **one closed period** (H1) in its history.
- **Improve Employee Compliance**: Completion, with full, partial and not-achieved results.
- **Improve Client Communication**: Completion, two KPIs at 50% each (*Client communication training*, *Client feedback follow-up procedure*). Organization → Customer Care → Team C → Moses, Aisha, Patrick, **Ronald Kintu**, plus Diana directly under Customer Care. Colleagues have full, partial and not-achieved results. Ronald has none yet: switch **View as → Employee — Ronald Kintu**, open **My KPIs**, then **Update → Partially achieved** and pick 25 / 50 / 75% or **Other %**.
- Joan Atim joined Team A on 1 Sep (Team A was re-split equally). Mark Ochieng and Hellen Apio are new hires who are not yet allocated, so they are ready for the Add member demo.
- Daniel's August update is locked and has a pending edit request.
- One draft goal (*Grow Digital Channels*) is stopped at step 3.
- FY 2025 is an ended cycle with results, for history and reuse.

## Assumptions to confirm

- Peer and supervisor ratings, professional attributes and PIPs from the old use-case document are **out of scope** for this prototype.
- Goal approval (UC_011) is replaced by the Draft → Ready → Running → Stopped status flow.
- For Sum KPIs, each update is **what was achieved since the previous update**; it is added to the running total. Progress = (current − start) ÷ (target − start) × 100 and is **not capped** at 100%.
- Goals are not weighted against each other. Goal progress = Σ (KPI progress × KPI weight in the goal). Person, team and department scores weight each KPI by its weight in its goal. The dashboard's average goal progress is for orientation only.

## Code map (for the developer)

```
src/
  data/seed.js            mock HR data, cycles, goals, KPIs, allocations, updates
  lib/calc.js             roll-up engine: nodeStats(), kpiProgress(), goalProgress(), rankings, edit lock
  lib/draft.js            wizard draft: validation, commit (draft → entities), reuse (goal → draft)
  store.jsx               all actions: cycles, goals, updates, edit requests, add member, restart/reset/reuse, audit log
  components/
    AllocationEditor.jsx  the % ↔ amount allocation table + staff picker (used at every level)
    KpiWidgets.jsx        allocation tree, update form, Add member flow, Restart, Reuse, chart
    ExcelUpload.jsx       template download + upload preview (SheetJS)
  pages/                  Dashboard, Cycles, Goals, GoalDetail, KpiDetail, Wizard, Drafts, MyKpis, Rankings, Admin
```

Data model: `goal (org only, no weight) → kpis (weight in goal) → periods → allocations` (a tree of department → team → individual, where `parentId` links the levels). `updates` are stored on leaf allocations, and every higher level is calculated from them, never stored.
