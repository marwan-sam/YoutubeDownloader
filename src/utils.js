// Helper functions for YouTube downloader

function validateYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/playlist\?list=)/;
  return youtubeRegex.test(url);
}

function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, '_');
}

module.exports = {
  validateYouTubeUrl,
  sanitizeFilename
};
