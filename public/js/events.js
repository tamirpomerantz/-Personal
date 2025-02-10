// public/js/events.js
import { loadImages } from './gallery.js';

function setupEvents() {
  const searchBox = document.getElementById('search-box');
  const clearButton = document.querySelector('.button-clear');
  clearButton.classList.add('button-clear--hidden'); // Hide clear button by default

  // Show or hide the clear button based on input value
  searchBox.addEventListener('input', function () {
    if (searchBox.value.trim() !== '') {
      clearButton.classList.remove('button-clear--hidden');
    } else {
      clearButton.classList.add('button-clear--hidden');
    }
  });

  // Clear the search box when the clear button is clicked
  clearButton.addEventListener('click', function () {
    searchBox.value = '';
    clearButton.classList.add('button-clear--hidden');
    loadImages("", false);
  });

  // Random toggle button for shuffling images
  const randomToggleButton = document.getElementById('random-toggle');
  let FetchIsRandom = false;
  randomToggleButton.addEventListener('click', function () {
    FetchIsRandom = !FetchIsRandom;
    if (FetchIsRandom) {
      randomToggleButton.classList.add('active-toggle');
    } else {
      randomToggleButton.classList.remove('active-toggle');
    }
    loadImages(searchBox.value.trim(), false, FetchIsRandom);
  });

  // Window resize: re-arrange images
  window.addEventListener('resize', function () {
    const gallery = document.getElementById('image-gallery');
    gallery.innerHTML = '';
    loadImages(searchBox.value.trim(), false);
  });

  // Infinite scroll: load more images when nearing the bottom
  let lastScrollTop = 0;
  let isScrollTriggered = false;
  window.addEventListener('scroll', () => {
    const currentScrollTop = window.scrollY;
    if (currentScrollTop > lastScrollTop) {
      if (!isScrollTriggered && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 400) {
        isScrollTriggered = true;
        loadImages(searchBox.value.trim(), true).then(() => {
          isScrollTriggered = false;
          if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 400) {
            window.dispatchEvent(new Event('scroll'));
          }
        });
      }
    }
    lastScrollTop = currentScrollTop;
  });

  // Search functionality: if the Enter key is pressed in the search box
  window.searchImages = function (event) {
    if (event.key === 'Enter') {
      loadImages(event.target.value.trim(), false);
    }
  };

  // Listen for a custom searchTag event (dispatched from the modal when a tag is clicked)
  window.addEventListener('searchTag', (e) => {
    searchBox.value = e.detail;
    loadImages(e.detail, false);
  });



  
        const mainTitle = document.querySelector('.main-title');
        console.log('rempving animation')
        mainTitle.addEventListener('animationend', function() {
            mainTitle.classList.add('animation-complete');
        });




  // You can also listen for custom modal navigation events if needed.
}

export { setupEvents };

// (Optionally, you can export an initializeImagesInView helper if needed.)
function initializeImagesInView() {
  // (This function can be empty if its functionality is handled in gallery.js.)
}
export { initializeImagesInView };