# Regatta and Performance Architecture

## Product boundary

A Regatta is a competition event, not a schedule category and not a performance record. Scheduling may link training plans and sessions to one or more Regattas, while the future Performance system owns prescribed metrics, athlete submissions, coach verification, and analytics.

Keeping these concerns separate prevents schedule templates from becoming a mixture of instructions, results, and reporting fields.

## Recommended Regatta model

Evolve the current Regatta record into a tenant-scoped competition aggregate with:

- Name, venue, timezone, start/end dates, registration deadline, and status.
- Competition priority such as A, B, or C and a configurable event type.
- Disciplines/events with distance, category, age group, gender/category rules, and boat or team class where relevant.
- Entries that assign an individual, crew, team, or class to a discipline.
- Crew positions and reserves where a sport requires them.
- Preparation window, taper window, goals, and coach notes.
- Lifecycle states: draft, confirmed, in progress, completed, cancelled, and archived.

Do not enforce non-overlapping Regatta dates. Real teams can attend simultaneous events or enter different squads in overlapping competitions. Show an overlap warning during creation, but allow an authorized coach to continue.

## Training plan relationship

Use a many-to-many relationship between schedule plans and Regattas. Add optional training-cycle entities when periodization is implemented:

`Season -> Macrocycle -> Mesocycle -> Microcycle -> Scheduled session`

Each cycle can target one or more Regattas. A schedule occurrence keeps immutable snapshots of its session prescription and metric schema so later template edits never alter historical reporting.

## Future Performance system

Performance should be a separate tenant-enabled system that depends on published Scheduling occurrences.

### Exercise catalogue

Coaches create reusable exercises such as 2,000 m ergometer, 500 m split, bench press, resting heart rate, or session RPE. An exercise is descriptive; its metrics define what is measured.

### Metric definitions

Each metric has:

- Stable code and human label.
- Data type: decimal, integer, duration, distance, percentage, rating, boolean, or choice.
- Unit and display precision.
- Valid minimum/maximum and whether lower, higher, or a target range is better.
- Required/optional rule and who may enter it.
- Aggregation rule: sum, average, minimum, maximum, latest, best, or none.
- Chart format and optional benchmark bands.

Examples include time in seconds, distance in metres, heart rate in bpm, stroke rate in spm, weight in kg, repetitions, power in watts, and RPE from 1 to 10. Store durations and quantities in canonical units, then format them for display.

### Session prescription

A session template contains ordered exercise blocks. Each block references an exercise and snapshots its metric definitions, prescribed targets, sets, repetitions, recovery, and coach instructions when a schedule occurrence is generated.

### Athlete results

An athlete submits one session result with child exercise results containing typed numeric values. Submissions have draft, submitted, verified, returned, and amended states. Coach corrections retain an audit trail; they do not overwrite the original silently.

Optional wellness and context inputs, such as sleep, soreness, illness, weather, or equipment, should be separate structured fields rather than unbounded result text.

## Reporting model

Reports should aggregate from verified typed results by:

- Athlete and exercise.
- Session occurrence.
- Day, week, month, and custom range.
- Training cycle.
- Regatta preparation window and Regatta.
- Class, crew, team, and tenant.

The reporting API should return both normalized series data and metric metadata, allowing the frontend to select a suitable line, bar, range, or comparison chart without guessing units or whether an increase is positive.

## Integration contracts

Scheduling should expose stable identifiers and domain events rather than writing Performance tables directly:

- `schedule.occurrence_published`
- `schedule.occurrence_replaced`
- `schedule.occurrence_cancelled`
- `regatta.updated`

Performance references the published occurrence and its snapshot. It must enforce tenant isolation and verify that an athlete was actively assigned to the occurrence before accepting results.

## Delivery sequence

1. Expand Regattas into events, disciplines, and entries without changing existing schedule links.
2. Add training cycles and optional Regatta targets to schedules.
3. Introduce the Performance system with exercise and metric-definition setup.
4. Add exercise prescriptions to session templates and snapshot them during publication.
5. Add athlete submission and coach verification.
6. Add trend, period, and Regatta reports after data quality and unit normalization are proven.

This sequence keeps today's Attendance and Scheduling workflows usable while giving Performance a structured numerical foundation.
