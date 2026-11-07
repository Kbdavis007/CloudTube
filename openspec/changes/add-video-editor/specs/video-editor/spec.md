# Spec Delta

## Purpose

Lets the owner build a single video from parts on the device: add clips, trim each to
the wanted span, order them, and preview the assembled result before exporting.

## ADDED Requirements

### Requirement: Add clips from a local file

The system SHALL let the user add a clip from a local media file. The system SHALL
reject a file it cannot decode and SHALL report the reason without adding the clip.

#### Scenario: Adding a supported local file
- **WHEN** the user selects a playable local video file
- **THEN** the clip is added to the timeline with its title, duration and resolution

#### Scenario: Rejecting an unsupported local file
- **WHEN** the user selects a file whose container or codec the browser cannot decode
- **THEN** the system adds no clip and shows an error naming the file

### Requirement: Add clips from a direct media URL

The system SHALL let the user add a clip from a direct media URL that returns a media
file. The system SHALL reject an embedded-player page and SHALL explain that only
direct media URLs are supported.

#### Scenario: Adding a direct media URL
- **WHEN** the user adds a URL that responds with a media file
- **THEN** the clip is added to the timeline with its title and duration

#### Scenario: Rejecting an embedded player page
- **WHEN** the user adds a URL for an embedded player page rather than a media file
- **THEN** the system adds no clip and explains that only direct media URLs are supported

#### Scenario: Rejecting a cross-origin URL that forbids reading
- **WHEN** the media host does not allow the response to be read by the app
- **THEN** the system adds no clip and reports that the host blocks in-browser reading

### Requirement: Add clips from the saved library

The system SHALL offer the saved videos that expose a direct media URL as a list to add
from, and SHALL NOT offer a video that only has an embed URL. Adding an offered video
SHALL read its media URL and add it as a clip.

#### Scenario: Listing editable saved videos
- **WHEN** the editor opens with saved videos that have a direct media URL
- **THEN** those videos are offered in the picker and embed-only videos are not

#### Scenario: Adding a saved video
- **WHEN** the user picks an offered saved video and adds it
- **THEN** the clip is added to the timeline from that video's media URL

#### Scenario: No editable saved videos
- **WHEN** the library has no video with a direct media URL
- **THEN** the picker explains that no saved video can be edited here

### Requirement: Add clips from built-in samples

The system SHALL offer a set of built-in sample clips, served by the app itself, so the
editor can be tried without a local file. A sample SHALL be addable like any other clip
and SHALL be readable without a cross-origin request.

#### Scenario: Listing built-in samples
- **WHEN** the editor opens
- **THEN** the built-in samples are offered in the picker

#### Scenario: Adding and exporting a sample
- **WHEN** the user adds a built-in sample and exports
- **THEN** the clip is added from the app-served media and one file is produced

### Requirement: Trim a clip to in and out points

The system SHALL let the user set an in point and an out point on a clip and SHALL use
only that span when the timeline is assembled. The in point SHALL be earlier than the
out point, and the system SHALL prevent an out point beyond the clip's duration.

#### Scenario: Setting a valid trim range
- **WHEN** the user sets an in point and a later out point within the clip
- **THEN** the clip shows its trimmed duration and only that span is used on export

#### Scenario: Preventing an invalid range
- **WHEN** the user drags the in point to or past the out point
- **THEN** the handles stop so the in point stays earlier than the out point

### Requirement: Reorder and remove clips

The system SHALL let the user change clip order and remove a clip. The export SHALL
follow the order shown in the timeline.

#### Scenario: Reordering clips
- **WHEN** the user moves a clip to a new position
- **THEN** the timeline and the preview order update to the new order

#### Scenario: Removing a clip
- **WHEN** the user removes a clip
- **THEN** the clip leaves the timeline and is not part of the assembled video

### Requirement: Preview the assembled timeline

The system SHALL preview the timeline as it will be exported, playing the clips in
order and honouring each clip's trim. The preview SHALL update when clips are added,
trimmed, reordered or removed.

#### Scenario: Playing the assembled timeline
- **WHEN** the user plays the timeline
- **THEN** the clips play in order, each restricted to its trimmed span

#### Scenario: Preview reflects an edit
- **WHEN** the user trims, reorders or removes a clip
- **THEN** the preview reflects the change the next time it plays

### Requirement: Editing stays on the device

The system SHALL read media for editing on the user's device and SHALL NOT upload
media bytes to any server.

#### Scenario: No media upload during editing
- **WHEN** the user adds, trims, reorders or previews clips
- **THEN** no media bytes are sent to the app's server
