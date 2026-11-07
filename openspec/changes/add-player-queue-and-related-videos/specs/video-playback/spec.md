# Spec Delta

## Purpose

Defines what happens while a video is being watched: moving to the previous or next
video in the list it was played from, and being offered related videos to watch next.

## ADDED Requirements

### Requirement: Prev/next walks the list the video was played from

The player SHALL move to the previous and next video of the list the watched video was
played from — the search results or the catalogue when it was opened from there, and the
saved library when it was opened from the library — rather than always the library.

#### Scenario: A result opened from search walks the results
- **WHEN** the user opens a video from a list of search results and presses Next
- **THEN** the player shows the next video in those results

#### Scenario: The counter names the list
- **WHEN** a video is being watched from a list
- **THEN** the player shows its position in that list and names the list (for example
  "Video 2 of 24 in Search results")

#### Scenario: A library video still walks the library
- **WHEN** the user opens a video from the saved library
- **THEN** Next and Previous move through the library

### Requirement: Navigating to an unsaved video does not save it

Moving within the play queue SHALL show the target video whether or not it is saved, and
SHALL NOT add it to the library; saving stays an explicit action.

#### Scenario: Next reaches an unsaved result
- **WHEN** the user presses Next onto a result that is not in the library
- **THEN** the player shows that video and still offers "Save to Library"

#### Scenario: Watching a run does not save the run
- **WHEN** the user moves through several unsaved results without pressing Save
- **THEN** none of them is added to the library

### Requirement: Related videos are offered under the player

The player SHALL show a Related videos section for the video being watched, offering
several similar videos. Relatedness SHALL be judged from the metadata each video carries,
weighting a shared uploader or a shared tag most, and the section SHALL fall back to
videos from the same source when too few strong matches exist.

#### Scenario: Related videos are shown
- **WHEN** the user watches a video
- **THEN** the player shows a Related videos section with several videos

#### Scenario: A shared uploader or tag ranks a video as related
- **WHEN** two videos share an uploader or a tag
- **THEN** each is offered as related to the other

#### Scenario: The current video and its neighbours are not repeated
- **WHEN** the Related videos section is built
- **THEN** it excludes the video being watched and the videos the prev/next buttons
  already reach

### Requirement: Playing a related video does not save it

Choosing a related video SHALL open it in the player, and SHALL NOT add it to the library;
saving stays an explicit action.

#### Scenario: A related video opens in the player
- **WHEN** the user chooses a related video
- **THEN** the player shows it and, if it is not saved, still offers "Save to Library"
