// utils/jsonDatabase.js
const path = require('path');
const { photosDir, jsonFilePath, fs } = require('./config');
const { resizeImage, performOCR } = require('./ocrResize');
const { encodeImage } = require('./imageProcessing');
const { getTagsFromOpenAI } = require('./aiTagging');
const EventEmitter = require('events');

const updateJSONFile = async () => {
  try {
    let imageData = {};

    // Ensure the JSON file exists; if not, create one.
    if (await fs.pathExists(jsonFilePath)) {
      imageData = await fs.readJson(jsonFilePath);
    } else {
      await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
      console.log('Created an empty images.json file.');
    }

    const photoFiles = await fs.readdir(photosDir);
    const newImageData = {};
    let hasNewImages = false;

    for (const photo of photoFiles) {
      if (!imageData[photo] && /\.(jpg|jpeg|png|gif|webp)$/i.test(photo)) {
        hasNewImages = true;
        const dateAdded = new Date().toISOString();
        newImageData[photo] = { 
          text: '', 
          tags: {
            tags: [],
            context: '',
            colors: []
          }, 
          date: dateAdded,
          needsTagging: true
        };
      }
    }

    if (hasNewImages) {
      const updatedImageData = { ...imageData, ...newImageData };
      await fs.writeJson(jsonFilePath, updatedImageData, { spaces: 2 });
      console.log('Updated images.json successfully!');
      return true; // Return true if images were added
    }
    return false; // Return false if no images were added
  } catch (err) {
    console.error('Error processing images:', err);
    return false;
  }
};

const watchPhotosDirectory = () => {
  const chokidar = require('chokidar');
  const watcher = new EventEmitter();
  let isUpdating = false;
  let initialRun = true;

  const fileWatcher = chokidar.watch(photosDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 0,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 1000
    }
  });

  fileWatcher.on('ready', async () => {
    if (!isUpdating) {
      isUpdating = true;
      try {
        const hasNewImages = await updateJSONFile();
        if (hasNewImages) {
          watcher.emit('imagesUpdated');
        }
      } finally {
        isUpdating = false;
        initialRun = false;
      }
    }
  });

  fileWatcher.on('add', async (pathAdded) => {
    if (!initialRun && /\.(png|webm|jpg)$/i.test(pathAdded)) {
      if (!isUpdating) {
        isUpdating = true;
        try {
          const hasNewImages = await updateJSONFile();
          if (hasNewImages) {
            watcher.emit('imagesUpdated');
          }
        } finally {
          isUpdating = false;
        }
      }
    }
  });

  return watcher;
};

module.exports = { updateJSONFile, watchPhotosDirectory };