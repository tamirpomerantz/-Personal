// public/js/main.js
import { setupModal, openImageModal } from './modal.js';
import { loadImages } from './gallery.js';
import { setupEvents } from './events.js';

let ws;

function setupWebSocket() {
  ws = new WebSocket(`ws://${window.location.host}`);

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'imagesUpdated') {
      console.log('New images detected, refreshing gallery...');
      const searchBox = document.getElementById('search-box');
      const searchQuery = searchBox.value.trim();
      const randomToggle = document.getElementById('random-toggle');
      const isRandom = randomToggle.classList.contains('active-toggle');
      
      // Only reload if there's no search query
      if (!searchQuery) {
        await loadImages('', isRandom, true);
      }
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    // Attempt to reconnect after a delay
    setTimeout(setupWebSocket, 5000);
  };
}

// Handle search functionality
async function handleSearch(query) {
  const randomToggle = document.getElementById('random-toggle');
  const isRandom = randomToggle.classList.contains('active-toggle');
  await loadImages(query, isRandom, true);
}

// When the DOM is ready, initialize all parts
document.addEventListener('DOMContentLoaded', function () {
  setupModal();
  setupEvents();
  setupWebSocket();

  // Listen for a custom event to open the modal
  window.addEventListener('openModal', (e) => {
    openImageModal(e.detail);
  });

  // Set up search box functionality
  const searchBox = document.getElementById('search-box');
  let searchTimeout;
  
  searchBox.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleSearch(e.target.value.trim());
    }, 300);
  });

  // Handle random toggle
  const randomToggle = document.getElementById('random-toggle');
  randomToggle.addEventListener('click', () => {
    randomToggle.classList.toggle('active-toggle');
    const isRandom = randomToggle.classList.contains('active-toggle');
    handleSearch(searchBox.value.trim());
  });

  // Start by loading images with no search term
  loadImages('', false);
});