# Spec Delta

## Purpose

Defines how a search runs — against the sources enabled in Settings — and how a
result can be played in place in its card before opening the full player.

## ADDED Requirements

### Requirement: Search runs against the sources enabled in Settings

A search SHALL run against exactly the sources the user has enabled in
**Settings → Search Sources**, and the search page SHALL NOT offer a second place to
change that selection. The page SHALL state which sources it will use and where to
change them.

#### Scenario: The page does not edit the source selection
- **WHEN** the user opens the search page
- **THEN** it shows no per-search source toggles, and points to Settings for changing them

#### Scenario: Changing sources in Settings changes the next search
- **WHEN** the user enables or disables a source in Settings and returns to search
- **THEN** the next search queries the updated set, with no reload

### Requirement: A search result can be played in place

Each result SHALL offer a Play control that plays the video **inside its own card**,
without leaving the results, and a search result that is playing SHALL NOT be added to
the library. A card SHALL be able to stop its own playback.

#### Scenario: Playing a result in its card
- **WHEN** the user presses Play on a result
- **THEN** the video plays inside that result's card

#### Scenario: Playing in a card does not save
- **WHEN** the user plays a result in its card without pressing Save
- **THEN** the result is not added to the library

#### Scenario: Stopping playback in a card
- **WHEN** the user presses Stop on a playing card
- **THEN** that card returns to its thumbnail

### Requirement: Several results can play at once

In-place playback SHALL be independent per card, so starting one result SHALL NOT stop
another.

#### Scenario: A second result plays alongside the first
- **WHEN** the user presses Play on a second result while a first is playing
- **THEN** both play at the same time

### Requirement: The full player stays reachable from a result

A result SHALL offer a way to open it in the dedicated player, and doing so SHALL carry
the whole result list as the play queue so prev/next walks the results.

#### Scenario: Opening the full player from a card
- **WHEN** the user chooses "Full page" on a result
- **THEN** the dedicated player opens that result, and its prev/next walk the result list

#### Scenario: A source that fails is reported without blocking
- **WHEN** one enabled source fails while others succeed
- **THEN** the results from the working sources still show, and the failed source is named
  in a non-blocking note
