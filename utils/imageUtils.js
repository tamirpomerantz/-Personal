// utils/imageUtils.js
const sharp = require('sharp');
const { jsonFilePath, fs } = require('./config');

const getImageDimensions = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return { width: 0, height: 0 };
  }
};

const getImagesData = () => {
  console.log('getimgdata');
  const data = fs.readFileSync(jsonFilePath, 'utf-8');
  const jsonData = JSON.parse(data);
  const reversedData = Object.keys(jsonData)
        .reverse()
        .reduce((acc, key) => {
            acc[key] = jsonData[key];
            return acc;
        }, {});
  return reversedData;
};

module.exports = { getImageDimensions, getImagesData };