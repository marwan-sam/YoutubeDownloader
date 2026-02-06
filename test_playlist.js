const YouTubeDownloader = require('./src/downloader');

const downloader = new YouTubeDownloader();

async function testPlaylist() {
  const url = 'http://youtube.com/watch?v=mrV8kK5t0V8&list=PLDIoUOhQQPlXr63I_vwF9GD8sAKh77dWU';
  try {
    const results = await downloader.downloadPlaylist(url, {
      type: 'video',
      quality: 'highest',
      format: 'mp4',
      outputDir: './downloads',
      subtitles: false
    });
    console.log('Download results:', results);
  } catch (error) {
    console.error('Error:', error);
  }
}

testPlaylist();
