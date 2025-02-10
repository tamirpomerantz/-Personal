// utils/jsonDatabase.js
const path = require('path');
const { photosDir, jsonFilePath, fs } = require('./config');
const { resizeImage, performOCR } = require('./ocrResize');
const { encodeImage } = require('./imageProcessing');
const { getTagsFromOpenAI } = require('./aiTagging');

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
    for (const photo of photoFiles) {
      if (!imageData[photo] && /\.(jpg|jpeg|png|gif|webp)$/i.test(photo)) {
        const photoPath = path.join(photosDir, photo);
        const resizedPhotoPath = await resizeImage(photoPath);
        const text = await performOCR(resizedPhotoPath);
        const base64Image = await encodeImage(resizedPhotoPath);
        const tags = await getTagsFromOpenAI(base64Image);
        
        const dateAdded = new Date().toISOString();
        newImageData[photo] = { text, tags, date: dateAdded };

        if (resizedPhotoPath !== photoPath) {
          await fs.remove(resizedPhotoPath);
        }
      }
    }

    const updatedImageData = { ...imageData, ...newImageData };
    await fs.writeJson(jsonFilePath, updatedImageData, { spaces: 2 });
    console.log('Updated images.json successfully!');
  } catch (err) {
    console.error('Error processing images:', err);
  }
};

const watchPhotosDirectory = () => {
  const chokidar = require('chokidar');
  let isUpdating = false;
  const watcher = chokidar.watch(photosDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 0,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  watcher.on('add', async (pathAdded) => {
    if (/\.(png|webm|jpg)$/i.test(pathAdded)) {
      console.log(`File ${pathAdded} has been added`);
      if (!isUpdating) {
        isUpdating = true;
        try {
          await updateJSONFile();
        } finally {
          isUpdating = false;
        }
      }
    }
  });
};

module.exports = { updateJSONFile, watchPhotosDirectory };