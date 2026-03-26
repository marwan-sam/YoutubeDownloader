#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const YouTubeDownloader = require('./downloader');
const { validateYouTubeUrl } = require('./utils');
const path = require('path');

const downloader = new YouTubeDownloader();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Interactive mode
    await interactiveMode();
    return;
  }

  const command = args[0];
  if (command === 'info') {
    const url = args[1];
    if (!url || !validateYouTubeUrl(url)) {
      console.error(chalk.red('Please provide a valid YouTube URL'));
      process.exit(1);
    }
    await showVideoInfo(url);
  } else if (command === 'download' || command === 'playlist') {
    await parseAndRunCommand(command, args.slice(1));
  } else {
    // Fallback for old command line mode or help
    console.log(chalk.yellow('Usage:'));
    console.log('  app download <url> [--audio] [--subtitles <lang>] [--quality <q>] [--output <dir>]');
    console.log('  app playlist <url> [--start <n>] [--end <n>] [--audio] [--quality <q>] [--output <dir>]');
    console.log('  app info <url>');
    process.exit(1);
  }
}

async function parseAndRunCommand(command, args) {
  const url = args[0];
  if (!url || !validateYouTubeUrl(url)) {
    console.error(chalk.red('Please provide a valid YouTube URL'));
    process.exit(1);
  }

  const options = {
    audio: false,
    subtitles: false,
    quality: 'highest',
    outputDir: './downloads',
    start: 1,
    end: null
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--audio') options.audio = true;
    else if (arg === '--subtitles') options.subtitles = args[++i] || true;
    else if (arg === '--quality') options.quality = args[++i];
    else if (arg === '--output') options.outputDir = args[++i];
    else if (arg === '--start') options.start = parseInt(args[++i]);
    else if (arg === '--end') options.end = parseInt(args[++i]);
  }

  try {
    const downloadOptions = {
      quality: options.quality,
      format: options.audio ? 'mp3' : 'mp4',
      subtitles: options.subtitles,
      outputDir: options.outputDir
    };

    if (command === 'download') {
      if (options.audio) {
        console.log(chalk.blue('Downloading audio...'));
        const result = await downloader.downloadAudio(url, downloadOptions);
        console.log(chalk.green(`Audio downloaded successfully: ${result}`));
      } else {
        console.log(chalk.blue('Downloading video...'));
        const result = await downloader.downloadVideo(url, downloadOptions);
        console.log(chalk.green(`Video downloaded successfully: ${result}`));
      }
    } else {
      console.log(chalk.blue('Downloading playlist...'));
      const result = await downloader.downloadPlaylist(url, {
        type: options.audio ? 'audio' : 'video',
        start: options.start,
        end: options.end,
        ...downloadOptions
      });
      console.log(chalk.green(`Playlist downloaded successfully. ${result.length} files processed.`));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function interactiveMode() {
  console.log(chalk.green.bold('Welcome to YouTube Downloader!'));

  const initialAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter YouTube URL (video or playlist):',
      validate: (input) => {
        if (validateYouTubeUrl(input)) {
          return true;
        }
        return 'Please enter a valid YouTube URL.';
      }
    },
    {
      type: 'list',
      name: 'type',
      message: 'Download type:',
      choices: ['single', 'playlist']
    }
  ]);

  let playlistRange = {};
  if (initialAnswers.type === 'playlist') {
    try {
      const playlistInfo = await downloader.getPlaylistInfo(initialAnswers.url);
      console.log(chalk.blue(`Playlist found: ${playlistInfo.title} (${playlistInfo.items.length} videos)`));
      playlistRange = await inquirer.prompt([
        {
          type: 'input',
          name: 'start',
          message: `Enter start video number (1-${playlistInfo.items.length}):`,
          default: '1',
          validate: (input) => {
            const num = parseInt(input);
            return (!isNaN(num) && num >= 1 && num <= playlistInfo.items.length) || 'Invalid number';
          }
        },
        {
          type: 'input',
          name: 'end',
          message: (answers) => `Enter end video number (${answers.start}-${playlistInfo.items.length}):`,
          default: (answers) => playlistInfo.items.length.toString(),
          validate: (input, answers) => {
            const num = parseInt(input);
            return (!isNaN(num) && num >= parseInt(answers.start) && num <= playlistInfo.items.length) || 'Invalid number';
          }
        }
      ]);
    } catch (error) {
      console.warn(chalk.yellow('Could not fetch playlist info for range selection, downloading full playlist.'));
    }
  }

  const moreAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Download format:',
      choices: ['video', 'audio']
    },
    {
      type: 'list',
      name: 'quality',
      message: 'Select quality:',
      choices: async (answers) => {
        if (initialAnswers.url && answers.format) {
          try {
            // For playlists, we just use defaults for quality selection in interactive mode
            if (initialAnswers.type === 'playlist') {
              return answers.format === 'video' ? ['highest', 'lowest', '1080p', '720p', '480p', '360p'] : ['highest', 'lowest'];
            }
            const info = await downloader.getVideoInfo(initialAnswers.url);
            if (answers.format === 'video') {
              return ['highest', 'lowest', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p'];
            } else {
              return ['highest', 'lowest'];
            }
          } catch (error) {
            console.warn('Could not fetch available qualities, using defaults');
          }
        }
        return answers.format === 'video' ? ['highest', 'lowest', '1080p', '720p'] : ['highest', 'lowest'];
      }
    },
    {
      type: 'list',
      name: 'audioFormat',
      message: 'Audio format (for audio downloads):',
      choices: ['mp3', 'm4a', 'wav'],
      when: (answers) => answers.format === 'audio'
    },
    {
      type: 'confirm',
      name: 'subtitles',
      message: 'Download subtitles?',
      default: false
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: './downloads'
    }
  ]);

  const answers = { ...initialAnswers, ...playlistRange, ...moreAnswers };

  try {
    const options = {
      quality: answers.quality,
      format: answers.audioFormat || 'mp4',
      subtitles: answers.subtitles,
      outputDir: answers.outputDir,
      start: parseInt(answers.start),
      end: parseInt(answers.end)
    };

    if (answers.type === 'single') {
      if (answers.format === 'video') {
        console.log(chalk.blue('Downloading video...'));
        const result = await downloader.downloadVideo(answers.url, options);
        console.log(chalk.green(`Video downloaded successfully: ${result}`));
      } else {
        console.log(chalk.blue('Downloading audio...'));
        const result = await downloader.downloadAudio(answers.url, options);
        console.log(chalk.green(`Audio downloaded successfully: ${result}`));
      }
    } else {
      console.log(chalk.blue('Downloading playlist...'));
      const result = await downloader.downloadPlaylist(answers.url, {
        type: answers.format,
        ...options
      });
      console.log(chalk.green(`Playlist downloaded successfully. ${result.length} files processed.`));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function showVideoInfo(url) {
  try {
    const info = await downloader.getVideoInfo(url);
    console.log('Video Information:');
    console.log(`Title: ${info.title}`);
    console.log(`Author: ${info.author}`);
    console.log(`Duration: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
    console.log('Available Formats:');
    info.formats.forEach((format, index) => {
      if (format.hasVideo && format.hasAudio) {
        console.log(`${index + 1}. Video: ${format.height}p, ${format.fps}fps, ${Math.round(format.bitrate / 1000)}kbps`);
      } else if (format.hasAudio && !format.hasVideo) {
        console.log(`${index + 1}. Audio: ${Math.round(format.bitrate / 1000)}kbps, ${format.audioCodec}`);
      }
    });
  } catch (error) {
    console.error('Error getting video info:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
