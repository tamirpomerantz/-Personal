// utils/config.js
const path = require('path');
require('dotenv').config(); // load env vars
const fs = require('fs-extra');

const PORT = 3000;

// The following paths assume that your main server file is in a subfolder (e.g. server/)
// and that your images.json is at the project root.
const photosDir = path.join(__dirname, '../../', ''); 
const jsonFilePath = path.join(__dirname, '../', 'images.json');
const apiKey = process.env.OPENAI_API_KEY;

module.exports = { PORT, photosDir, jsonFilePath, apiKey, fs };