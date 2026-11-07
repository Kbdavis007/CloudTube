# Spec Delta

## Purpose

Gives every list of videos in the app the same way to search, filter, sort and page
through them, so the controls and their meaning do not change from one list to the next.

## ADDED Requirements

### Requirement: The same browsing controls on every video list

The system SHALL offer the same search, filter, sort and pagination controls on every
list of videos it shows — the saved library, the live search results, and the baked
catalogue. A control SHALL mean the same thing wherever it appears.

#### Scenario: Controls appear on each list
- **WHEN** the user opens the library listing, the search results, or the catalogue
- **THEN** each shows a search box and filters for source, channel, tag, score, rating,
  duration and published date, and a sort control

#### Scenario: A control means the same thing on every list
- **WHEN** the user applies the same filter on two different lists
- **THEN** each list keeps the videos that satisfy that filter, judged the same way

### Requirement: Free-text search narrows by matching every term

The system SHALL filter a list by a free-text query that matches against a video's
title, channel, description and tags. Every whitespace-separated term in the query SHALL
have to match, so adding a term narrows the list rather than widening it.

#### Scenario: Matching a term
- **WHEN** the user types a term that appears in a video's title, channel, description or tags
- **THEN** that video remains in the list and the count of matches updates

#### Scenario: Adding a second term narrows
- **WHEN** the user adds a second term that a video does not contain
- **THEN** that video is removed from the list

### Requirement: Filters narrow by source, channel, tag, score, rating, duration and date

The system SHALL let the user narrow a list by source, channel, tag, score band, rating
state, duration band, and a published-date range. The option lists SHALL be derived from
the videos in the list, so a filter never offers a value that would match nothing.

#### Scenario: Filtering by source
- **WHEN** the user selects a source
- **THEN** only videos from that source remain, and the option list only offers sources
  that are present

#### Scenario: Filtering by score, rating, duration or date
- **WHEN** the user selects a score band, rating state, duration band, or a published-date range
- **THEN** only videos that satisfy it remain

### Requirement: Sorting reorders the list without changing its membership

The system SHALL let the user sort a list by score, rating, published date, title,
channel, duration or views, without changing which videos are in the list.

#### Scenario: Sorting by a chosen key
- **WHEN** the user picks a sort key
- **THEN** the list is reordered by that key and the same videos remain

#### Scenario: The source list is not mutated
- **WHEN** a list is filtered and sorted
- **THEN** the original order of the input is left unchanged

### Requirement: Long lists are paginated

The system SHALL page a list of videos so a long list stays quick to scan, showing the
page number and total pages and letting the user move to the first, previous, next and
last page.

#### Scenario: Moving between pages
- **WHEN** the list has more videos than fit on one page
- **THEN** the user can move to another page and the page indicator updates

#### Scenario: A single page shows no pagination
- **WHEN** every video fits on one page
- **THEN** no pagination control is shown

### Requirement: Clearing filters restores the full list

The system SHALL offer a way to clear the active filters and sort, returning the list to
its default ordering and showing every video again.

#### Scenario: Clearing active filters
- **WHEN** the user clears the filters after narrowing the list
- **THEN** the search box is emptied, the filters and sort reset, and every video shows again

#### Scenario: Clear is only offered when a filter is active
- **WHEN** no filter or non-default sort is set
- **THEN** the clear control is not shown

### Requirement: List-specific behaviour is preserved

The system SHALL keep each list's list-specific behaviour while sharing the browsing
controls: the library keeps its bulk actions, the search results keep the personalized
ranking toggle, and the catalogue search SHALL also match fields its records carry beyond
the common video model (actors and category).

#### Scenario: Personalized ranking stays available on search results
- **WHEN** the user views search results
- **THEN** the personalized ranking toggle is still offered alongside the shared controls

#### Scenario: Catalogue search reaches extra fields
- **WHEN** the user searches the catalogue for an actor or category
- **THEN** matching catalogue videos remain in the list
