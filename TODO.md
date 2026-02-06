# TODO: Enhance Playlist Download with Range Selection and Duplicate Skipping

## Steps to Complete

- [x] Import the `readline` module at the top of `src/downloader.js`.
- [x] Modify the `downloadPlaylist` method to prompt the user for the start index (X, default 1) and end index (Z, default playlist length).
- [x] Add validation for user input: ensure X is between 1 and playlist length, Z is between X and playlist length.
- [x] Update the download loop to iterate from index X-1 to Z-1 (0-based indexing).
- [x] Before downloading each video, check if the output file (based on video title and type) already exists in the output directory.
- [x] If the file exists, skip the download and log a message indicating the skip.
- [x] Update console logs to reflect the selected range, user input, and any skipped downloads.
- [x] Test the updated functionality with a sample playlist to ensure user input works, downloads are within the specified range, and duplicates are skipped.
- [x] Verify file existence checks work correctly.
