// utils/ocrResize.js
const path = require('path');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

const performOCR = async (imagePath) => {
  const worker = await createWorker();
  try {
    const { data: { text } } = await worker.recognize(imagePath);
    return text.trim();
  } finally {
    await worker.terminate();
  }
};

const resizeImage = async (imagePath) => {
  const metadata = await sharp(imagePath).metadata();
  const maxDim = 550;
  
  if (metadata.width > maxDim || metadata.height > maxDim) {
    const scaleFactor = maxDim / Math.max(metadata.width, metadata.height);
    const newWidth = Math.round(metadata.width * scaleFactor);
    const newHeight = Math.round(metadata.height * scaleFactor);

    const resizedImagePath = `${path.parse(imagePath).name}-resized${path.parse(imagePath).ext}`;
    await sharp(imagePath)
      .resize(newWidth, newHeight)
      .toFile(resizedImagePath);

    return resizedImagePath;
  }
  return imagePath;
};

module.exports = { performOCR, resizeImage };