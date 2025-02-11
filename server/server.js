// server/server.js
const express = require('express');
const path = require('path');
const app = express();
const { PORT, photosDir } = require('../utils/config');
const { watchPhotosDirectory, updateJSONFile } = require('../utils/jsonDatabase');
const apiRoutes = require('../routes/api');
const http = require('http');
const WebSocket = require('ws');

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

// Broadcast to all connected clients
const broadcast = (message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

// Run the initial update of the JSON database and start watching the images directory.
(async () => {
  await updateJSONFile();
})();

// Modified watchPhotosDirectory to use WebSocket notifications
const modifiedWatchPhotosDirectory = () => {
  const watcher = watchPhotosDirectory();
  watcher.on('imagesUpdated', () => {
    broadcast({ type: 'imagesUpdated' });
  });
};

modifiedWatchPhotosDirectory();

// Middleware: serve images and public assets
app.use('/photos', express.static(path.join(__dirname, '../..', '')));
app.use(express.json());
app.use(express.static('public'));

// Mount API routes at /api
app.use('/api', apiRoutes);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});