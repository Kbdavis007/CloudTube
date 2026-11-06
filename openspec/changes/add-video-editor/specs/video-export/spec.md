# Spec Delta

## Purpose

Turns the assembled timeline into a single video file the user can keep: choose the
output container and resolution, encode with visible progress, download the result, and
see recent exports.

## ADDED Requirements

### Requirement: Export the timeline as one file

The system SHALL encode the assembled timeline into a single video file and SHALL offer
it as a download. The exported file SHALL contain the clips in timeline order, each
restricted to its trimmed span.

#### Scenario: Exporting a two-clip timeline
- **WHEN** the user exports a timeline of two trimmed clips
- **THEN** one file is produced containing both clips in order, each only its trimmed span

#### Scenario: Refusing an empty timeline
- **WHEN** the user asks to export with no clips on the timeline
- **THEN** the system exports nothing and explains that the timeline is empty

### Requirement: Choose the output container and resolution

The system SHALL let the user choose the output container and resolution before
exporting, and SHALL default to MP4 at the highest resolution the clips provide.

#### Scenario: Choosing an output option
- **WHEN** the user picks a container or resolution and exports
- **THEN** the produced file uses the chosen container and resolution

### Requirement: Show progress and allow cancel

The system SHALL show export progress and SHALL let the user cancel. A cancelled export
SHALL produce no download and SHALL leave the timeline unchanged.

#### Scenario: Progress during export
- **WHEN** an export is running
- **THEN** the system shows progress that advances to completion

#### Scenario: Cancelling an export
- **WHEN** the user cancels a running export
- **THEN** no download starts and the timeline is unchanged

### Requirement: Handle export failure

The system SHALL keep the timeline intact when an export fails and SHALL report the
failure.

#### Scenario: An export that fails
- **WHEN** the export fails partway through
- **THEN** no partial file is offered and the timeline is still there to retry

### Requirement: Record recent exports

The system SHALL record each completed export's metadata — file name, container,
resolution, size and time — and SHALL NOT store the exported media bytes.

#### Scenario: Recording a completed export
- **WHEN** an export completes
- **THEN** the system records its metadata and lists it among recent exports

#### Scenario: Not storing exported media
- **WHEN** an export has been recorded
- **THEN** only metadata is stored and the exported file is not kept by the system
