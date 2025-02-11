// public/js/main.js
import { setupModal, openImageModal } from './modal.js';
import { loadImages } from './gallery.js';
import { setupEvents } from './events.js';


// When the DOM is ready, initialize all parts
document.addEventListener('DOMContentLoaded', function () {
  // Call each module’s setup function
  setupModal();
  setupEvents();

  // Listen for a custom event (dispatched when a gallery image is clicked) to open the modal.
  window.addEventListener('openModal', (e) => {
    openImageModal(e.detail);
  });

  // Start by loading images with no search term.
  loadImages('', false);
});