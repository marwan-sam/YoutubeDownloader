# YouTube Downloader Node.js App

A Node.js application to download YouTube videos and playlists as video or audio files with advanced quality selection and subtitle support.

## Features

- Download single YouTube videos or entire playlists
- Choose between video (MP4) or audio-only (MP3/MP4) formats
- Select specific video resolutions (2160p, 1440p, 1080p, 720p, 480p, 360p, 240p) or quality levels
- Interactive CLI with real-time quality information display
- Automatic playlist detection and folder creation
- Subtitle download support (English by default)
- Progress bars for downloads and playlist tracking
- Error handling for private, age-restricted, and unavailable videos
- FFmpeg integration for audio conversion

## Installation

```bash
npm install
```

## Usage

### Interactive Mode
```bash
node index.js
# or
npm start
```

The interactive mode will guide you through:

1. **Enter YouTube URL (video or playlist):** Input your YouTube URL
2. **Download type (audio or video):** Choose between audio or video download
3. **Quality Selection:** After fetching video info, select from available qualities
4. **Subtitle Language:** Optional subtitle download (leave empty to skip)
5. **Output Directory:** Choose where to save files

For playlists, the app automatically creates a folder with the playlist name.

### Command Line Mode
```bash
node index.js <url> <type> <format> <output> [quality] [subtitleLang]
node index.js info <url>
```

### Parameters
- `url`: YouTube video or playlist URL
- `type`: `single` or `playlist`
- `format`: `video` or `audio`
- `output`: Output directory (required)
- `quality`: Quality option (optional, defaults to `highest`)
  - For video: `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `240p`, `highest`, `lowest`
  - For audio: `highest`, `lowest`
- `subtitleLang`: Subtitle language code (optional, e.g., `EN`, `AR`)

### Examples

```bash
# Get video information and available qualities
node index.js info "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Download single video as MP4 with 1080p resolution
node index.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ" single video ./downloads 1080p

# Download single video as MP4 with highest quality
node index.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ" single video ./downloads highest

# Download audio as MP3 with highest quality
node index.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ" single audio ./downloads highest mp3

# Download playlist as audio files (creates playlist folder automatically)
node index.js "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy4qtr5f2" playlist audio ./music

# Interactive mode with prompts
npm run download
```

## Requirements

- Node.js
- FFmpeg (automatically included via ffmpeg-static)

## Notes

- Downloading copyrighted content may violate YouTube's terms of service
- Use responsibly for educational purposes only
- Playlist downloads automatically create a folder with the playlist title
- Quality options are validated against actual available formats for each video
- Subtitles are downloaded in SRT format if available

## Dependencies

- @distube/ytdl-core: YouTube video downloading
- ytpl: YouTube playlist parsing
- ffmpeg-static: Audio/video processing
- inquirer: Interactive CLI prompts
- fs-extra: Enhanced file system operations
- cli-progress: Progress bar display
- youtube-transcript: Subtitle downloading
