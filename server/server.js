// server/server.js
const express = require('express');
const path = require('path');
const app = express();
const { PORT, photosDir } = require('../utils/config');
const { watchPhotosDirectory, updateJSONFile } = require('../utils/jsonDatabase');
const apiRoutes = require('../routes/api');

// Run the initial update of the JSON database and start watching the images directory.
(async () => {
  await updateJSONFile();
})();

watchPhotosDirectory();

// Middleware: serve images and public assets
app.use('/photos', express.static(path.join(__dirname, '../..', '')));
app.use(express.json());
app.use(express.static('public'));

// Mount API routes at /api
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});