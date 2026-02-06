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
  } else if (args[0] === 'info') {
    // Get video info
    const url = args[1];
  if (!url || !validateYouTubeUrl(url)) {
    console.error(chalk.red('Please provide a valid YouTube URL'));
    process.exit(1);
  }
    await showVideoInfo(url);
  } else {
    // Command line mode
    await commandLineMode(args);
  }
}

async function interactiveMode() {
  console.log(chalk.green.bold('Welcome to YouTube Downloader!'));

  const answers = await inquirer.prompt([
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
    },
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
        if (answers.url && answers.format) {
          try {
            const info = await downloader.getVideoInfo(answers.url);
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

  try {
    const options = {
      quality: answers.quality,
      format: answers.audioFormat || 'mp4',
      subtitles: answers.subtitles,
      outputDir: answers.outputDir
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
      console.log(chalk.green(`Playlist downloaded successfully. ${result.length} files downloaded.`));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function commandLineMode(args) {
  // node index.js <url> <type> <format> <output> [quality] [subtitleLang]
  const [url, type, format, outputDir, quality = 'highest', subtitleLang] = args;

  if (!url || !type || !format || !outputDir) {
    console.error('Usage: node index.js <url> <type> <format> <output> [quality] [subtitleLang]');
    console.error('Example: node index.js "https://youtube.com/watch?v=..." single video ./downloads 1080p');
    process.exit(1);
  }

  if (!validateYouTubeUrl(url)) {
    console.error('Invalid YouTube URL');
    process.exit(1);
  }

  try {
    const options = {
      quality,
      format: format === 'audio' ? 'mp3' : 'mp4',
      subtitles: !!subtitleLang,
      outputDir
    };

    if (type === 'single') {
      if (format === 'video') {
        console.log(chalk.blue('Downloading video...'));
        const result = await downloader.downloadVideo(url, options);
        console.log(chalk.green(`Video downloaded successfully: ${result}`));
      } else {
        console.log(chalk.blue('Downloading audio...'));
        const result = await downloader.downloadAudio(url, options);
        console.log(chalk.green(`Audio downloaded successfully: ${result}`));
      }
    } else if (type === 'playlist') {
      console.log(chalk.blue('Downloading playlist...'));
      const result = await downloader.downloadPlaylist(url, {
        type: format,
        ...options
      });
      console.log(chalk.green(`Playlist downloaded successfully. ${result.length} files downloaded.`));
    } else {
      console.error(chalk.red('Invalid type. Use "single" or "playlist"'));
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
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
