// utils/imageProcessing.js
const fs = require('fs-extra');

const encodeImage = async (imagePath) => {
  const imageBuffer = await fs.readFile(imagePath);
  return imageBuffer.toString('base64');
};

function extractTags(inputText) {
  let start = inputText.indexOf('<tags>') + 6;
  if (start === 5) {
      return [];
  }
  let end = inputText.indexOf('</tags>', start);
  if (end === -1) {
      return [];
  }
  let tagString = inputText.substring(start, end).trim();
  if (tagString === '') {
      return [];
  }
  let tags = tagString.split(',').map(tag => tag.trim());
  return tags;
}

function extractColors(inputText) {
  let start = inputText.indexOf('<colors>') + 8;
  if (start === 7) {
      return [];
  }
  let end = inputText.indexOf('</colors>', start);
  if (end === -1) {
      return [];
  }
  let tagString = inputText.substring(start, end).trim();
  if (tagString === '') {
      return [];
  }
  let tags = tagString.split(',').map(tag => tag.trim());
  return tags;
}

function removeTagsAndNewlines(inputString) {
  return inputString.replace(/<[^>]*>.*?<\/[^>]*>/gs, '').replace(/\n/g, '');
}

module.exports = { encodeImage, extractTags, extractColors, removeTagsAndNewlines };