const ytdl = require('@distube/ytdl-core');
const ytpl = require('ytpl');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const cliProgress = require('cli-progress');
const { YoutubeTranscript } = require('youtube-transcript');
const readline = require('readline');

class YouTubeDownloader {
  constructor() {
    this.progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    // Suppress ytdl-core warnings and set cache directory
    process.env.YTDL_NO_UPDATE = 'true';

    // Override console.warn to suppress ytdl-core warnings
    const originalWarn = console.warn;
    console.warn = function(...args) {
      if (args[0] && typeof args[0] === 'string' &&
          (args[0].includes('Could not parse') || args[0].includes('Stream URLs will be missing'))) {
        return; // Suppress ytdl-core warnings
      }
      originalWarn.apply(console, args);
    };

    const cacheDir = path.join(__dirname, '..', 'cache');
    fs.ensureDirSync(cacheDir);
    ytdl.cache.dir = cacheDir;
  }

  async getVideoInfo(url) {
    try {
      const info = await ytdl.getInfo(url);
      return {
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        duration: info.videoDetails.lengthSeconds,
        formats: info.formats,
        thumbnails: info.videoDetails.thumbnails
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async getPlaylistInfo(url) {
    try {
      // Get playlist ID from URL
      const playlistId = await ytpl.getPlaylistID(url);

      // Fetch playlist with all items using pages
      let playlist = await ytpl(playlistId, {
        limit: Infinity,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });

      // Continue fetching if there are more pages
      while (playlist.continuation) {
        try {
          if (Array.isArray(playlist.continuation)) {
            console.warn('Continuation is an array, cannot continue fetching pages');
            break;
          }
          const nextPage = await ytpl.continueReq(playlist.continuation);
          playlist.items.push(...nextPage.items);
          playlist.continuation = nextPage.continuation;
        } catch (error) {
          // If continuation fails, break and use what we have
          console.warn('Could not fetch all playlist pages:', error.message);
          break;
        }
      }

      return {
        title: playlist.title,
        author: playlist.author.name,
        items: playlist.items.map(item => ({
          title: item.title,
          url: item.url,
          id: item.id
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get playlist info: ${error.message}`);
    }
  }

  async downloadVideo(url, options) {
    const { quality, outputDir, subtitles } = options;
    await fs.ensureDir(outputDir);

    const info = await this.getVideoInfo(url);
    const format = this.selectFormat(info.formats, quality, 'video');

    const outputPath = path.join(outputDir, this.sanitizeFilename(`${info.title}.mp4`));

    return new Promise((resolve, reject) => {
      const videoStream = ytdl(url, { format, highWaterMark: 1 << 25 }); // 32MB buffer
      const writeStream = fs.createWriteStream(outputPath);

      this.progressBar.start(format.contentLength || 0, 0);

      videoStream.on('progress', (chunkLength, downloaded, total) => {
        this.progressBar.update(downloaded);
      });

      videoStream.pipe(writeStream);

      writeStream.on('finish', async () => {
        this.progressBar.stop();
        if (subtitles) {
          await this.downloadSubtitles(url, outputDir, info.title);
        }
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        this.progressBar.stop();
        reject(error);
      });
    });
  }

  async downloadAudio(url, options) {
    const { quality, format, outputDir, subtitles } = options;
    await fs.ensureDir(outputDir);

    const info = await this.getVideoInfo(url);
    // For audio, download the best video format and convert with ffmpeg
    const videoFormat = this.selectFormat(info.formats, quality, 'video');

    const tempVideoPath = path.join(outputDir, this.sanitizeFilename(`${info.title}_temp.mp4`));
    const outputPath = path.join(outputDir, this.sanitizeFilename(`${info.title}.${format}`));

    return new Promise((resolve, reject) => {
      const videoStream = ytdl(url, { format: videoFormat, highWaterMark: 1 << 25 });
      const writeStream = fs.createWriteStream(tempVideoPath);

      this.progressBar.start(videoFormat.contentLength || 0, 0);

      videoStream.on('progress', (chunkLength, downloaded, total) => {
        this.progressBar.update(downloaded);
      });

      videoStream.pipe(writeStream);

      writeStream.on('finish', async () => {
        this.progressBar.stop();
        // Convert to audio using ffmpeg
        await this.convertToAudio(tempVideoPath, outputPath, format);
        // Remove temp file
        await fs.remove(tempVideoPath);
        if (subtitles) {
          await this.downloadSubtitles(url, outputDir, info.title);
        }
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        this.progressBar.stop();
        reject(error);
      });
    });
  }

  async convertToAudio(inputPath, outputPath, format) {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpeg, [
        '-i', inputPath,
        '-vn', // no video
        '-acodec', format === 'mp3' ? 'libmp3lame' : 'aac',
        '-ab', '128k', // bitrate
        '-ar', '44100', // sample rate
        '-y', // overwrite
        outputPath
      ]);

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async downloadPlaylist(url, options) {
    const { type, quality, format, outputDir, subtitles } = options;
    const playlistInfo = await this.getPlaylistInfo(url);
    const playlistDir = path.join(outputDir, this.sanitizeFilename(playlistInfo.title));
    await fs.ensureDir(playlistDir);

    console.log(`Downloading playlist: ${playlistInfo.title}`);
    console.log(`Total videos: ${playlistInfo.items.length}`);

    // Prompt user for start and end indices
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const start = await this.promptUser(rl, `Enter start video number (1-${playlistInfo.items.length}, default 1): `, 1, playlistInfo.items.length);
    const end = await this.promptUser(rl, `Enter end video number (${start}-${playlistInfo.items.length}, default ${playlistInfo.items.length}): `, start, playlistInfo.items.length);

    rl.close();

    console.log(`Downloading videos from ${start} to ${end}`);

    const results = [];
    for (let i = start - 1; i < end; i++) {
      const item = playlistInfo.items[i];
      console.log(`\nProcessing ${i + 1}/${playlistInfo.items.length}: ${item.title}`);

      // Check if file already exists
      const info = await this.getVideoInfo(item.url);
      const extension = type === 'video' ? 'mp4' : format;
      const outputPath = path.join(playlistDir, this.sanitizeFilename(`${info.title}.${extension}`));

      if (await fs.pathExists(outputPath)) {
        console.log(`Skipping ${item.title}: File already exists`);
        continue;
      }

      try {
        let result;
        if (type === 'video') {
          result = await this.downloadVideo(item.url, { quality, outputDir: playlistDir, subtitles });
        } else {
          result = await this.downloadAudio(item.url, { quality, format, outputDir: playlistDir, subtitles });
        }
        results.push(result);
      } catch (error) {
        console.error(`Failed to download ${item.title}: ${error.message}`);
      }
    }

    return results;
  }

  selectFormat(formats, quality, type) {
    let filteredFormats = formats;

    if (type === 'video') {
      filteredFormats = formats.filter(f => f.hasVideo && f.hasAudio);
    } else {
      filteredFormats = formats.filter(f => f.hasAudio && !f.hasVideo);
    }

    if (quality === 'highest') {
      return filteredFormats.sort((a, b) => b.bitrate - a.bitrate)[0];
    } else if (quality === 'lowest') {
      return filteredFormats.sort((a, b) => a.bitrate - b.bitrate)[0];
    } else {
      // Specific quality like '1080p'
      const targetHeight = parseInt(quality);
      return filteredFormats.find(f => f.height === targetHeight) || filteredFormats[0];
    }
  }

  async downloadSubtitles(url, outputDir, title) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      const srtContent = this.transcriptToSrt(transcript);
      const srtPath = path.join(outputDir, this.sanitizeFilename(`${title}.srt`));
      await fs.writeFile(srtPath, srtContent);
    } catch (error) {
      console.warn(`Failed to download subtitles: ${error.message}`);
    }
  }

  transcriptToSrt(transcript) {
    return transcript.map((item, index) => {
      const start = this.formatTime(item.offset / 1000);
      const end = this.formatTime((item.offset + item.duration) / 1000);
      return `${index + 1}\n${start} --> ${end}\n${item.text}\n`;
    }).join('\n');
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
  }

  promptUser(rl, question, min, max) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        const num = parseInt(answer.trim(), 10);
        if (isNaN(num) || num < min || num > max) {
          resolve(max); // default to max if invalid
        } else {
          resolve(num);
        }
      });
    });
  }
}

module.exports = YouTubeDownloader;
