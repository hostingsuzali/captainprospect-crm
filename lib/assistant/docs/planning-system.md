---
routes: ["/manager/planning", "/manager/planning/conflicts", "/sdr/calendar", "/sdr/planning"]
roles: ["MANAGER", "SDR", "BOOKER"]
keywords: ["planning", "planification", "allocation", "schedule", "capacité", "capacity", "conflict", "conflit", "P0", "P1", "P2", "absence", "congé", "vacation", "jour", "day", "mois", "month", "SDR planning", "schedule block", "bloc", "allocation", "overscheduled", "underallocated", "mission day", "jours mission"]
priority: 9
---

# Planning & SDR Scheduling System

## Overview

The planning system assigns **SDR days to missions by month**. A manager allocates how many days each SDR works on each mission, then the system generates daily schedule blocks.

**Key concepts:**
- **Allocation** — number of days per month an SDR works a specific mission
- **Schedule block** — a single day block for a specific SDR + mission  
- **Capacity** — the SDR's available working days per month (adjusted for absences, public holidays)
- **Conflict** — when allocations exceed capacity or create other planning issues

---

## Accessing Planning

- Manager: **Équipe → Planning** → `/manager/planning`
- SDR: **Organisation → Planning** → `/sdr/planning` (read-only)
- SDR calendar view: `/sdr/calendar`

---

## Monthly Planning View

The planning page shows a **monthly calendar grid**:
- **Rows** = SDRs
- **Columns** = days of the month
- **Cells** = colored blocks showing mission assignments
- **Red highlights** = conflicts

### Navigate months:
- Use the **← →** arrows in the sticky header to go to previous/next month

---

## Adding an Allocation (Assign SDR to Mission)

1. Go to `/manager/planning`
2. Select the target month
3. Click on an SDR's row or a specific day cell
4. Click **Ajouter allocation**
5. Fill the form:
   - **Mission** — select from active missions
   - **Jours alloués** — how many days this SDR works this mission this month
   - **Semaines préférées** — which weeks (optional preference)
6. Click **Confirmer**
7. The system distributes those days across the month calendar

---

## Editing or Removing an Allocation

1. Click the existing block on the calendar
2. Click **Modifier** → adjust days
3. Click **Supprimer** → removes the allocation block

---

## Conflict System: P0 / P1 / P2

The system automatically detects and flags conflicts:

| Severity | Label | Meaning | Action required |
|----------|-------|---------|-----------------|
| **P0** | Critical | SDR is overbooked — allocations exceed available days | Must resolve before month starts |
| **P1** | Important | Mission has insufficient SDR coverage | Review and add SDRs or adjust days |
| **P2** | Minor | Suboptimal allocation (e.g. SDR preference not met) | Recommended to review |

### Resolve Conflicts

1. Go to `/manager/planning/conflicts`
2. Each conflict card shows: severity, type, affected SDR, affected mission, message, and suggested action
3. Click **Résoudre** on each conflict
4. Follow the suggested action (reduce allocation, add SDR, etc.)
5. Once resolved: conflict disappears from the list

Or resolve inline from the planning calendar: click a conflicted cell → popup shows the conflict and resolution options.

---

## SDR Capacity

Each SDR has a **monthly capacity** (base working days minus absences).

View capacity:
- Planning calendar → hover or click an SDR row → capacity shown as "X jours disponibles"
- Or: `/manager/planning` → click SDR name → capacity detail view

**Capacity is calculated as:**
`Base working days` − `Public holidays` − `Absence days` − `Partial days`

---

## Managing Absences

Add an absence for an SDR:
1. Go to `/manager/planning`
2. Click the SDR's name row
3. Click **Ajouter une absence**
4. Fill: start date, end date, type (VACATION / SICK / TRAINING / PUBLIC_HOLIDAY / PARTIAL)
5. Check **Impacts planning** to automatically reduce capacity
6. Click **Confirmer**

The SDR's available days are automatically recalculated. P0 conflicts will appear if existing allocations now exceed reduced capacity.

**Absence types:**
- VACATION — paid leave
- SICK — sick leave
- TRAINING — internal training days
- PUBLIC_HOLIDAY — bank holiday (can add custom ones)
- PARTIAL — half-day or reduced capacity day

---

## Schedule Blocks: Confirm / Reject

Schedule blocks can require approval before becoming active:

- **SUGGESTED** — system generated, awaiting confirmation
- **CONFIRMED** — confirmed and active  
- **CANCELLED** — rejected/cancelled

Manager actions per block:
- **Confirmer** — mark as confirmed (SDR can see it as active)
- **Rejeter** — mark as cancelled (SDR won't see it)
- **Bulk confirm** — confirm all suggested blocks for a period

---

## SDR View of Their Schedule

SDRs see their schedule at `/sdr/calendar`:
- Month view with colored blocks per day
- Click a block to see: mission, time range, status
- Cannot edit — manager controls the schedule
- Green block = confirmed | Gray = suggested (pending)

---

## Weekly Pattern (Advanced)

An SDR can have a **weekly pattern** for a mission — e.g., work Mission A on Monday/Wednesday, Mission B on Tuesday/Thursday.

Set in: allocation form → **Jours préférés** (preferred days of week) → select day pattern.

---

## Common Planning Scenarios

### SDR is on vacation next week — what to do?
1. Add absence at `/manager/planning` → SDR row → Ajouter une absence
2. Set start/end dates of vacation, type = VACATION
3. System reduces their capacity → any P0 conflicts appear
4. Resolve conflicts by redistributing their mission days to other SDRs

### Mission needs more coverage this month?
1. Go to `/manager/planning`
2. Find other SDRs with available capacity (green/no conflicts)
3. Add allocation → link those SDRs to the mission → set days
4. Check conflicts after adding

### Two missions overlap on the same SDR day?
This is a **P0 conflict** (double-booking). Resolve by:
- Reducing one mission's allocated days
- Moving one mission's block to another day (click block → drag or edit)
- Or assigning a different SDR to one of the missions

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| SDR doesn't appear in planning | Check they are active (Réglages tab) and have role SDR or BOOKER |
| P0 conflict won't clear | Reduce total allocated days below SDR's available capacity |
| SDR says they have no schedule | Check they have confirmed blocks for the current month in `/manager/planning` |
| Mission shows no SDR | Open the mission's month row in planning → all cells empty = no allocation made |
| SDR sees wrong blocks in calendar | Verify their allocations are confirmed (not just SUGGESTED) |
