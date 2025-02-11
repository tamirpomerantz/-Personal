// public/js/events.js
import { loadImages, setCurrentPage } from './gallery.js';
import { getTagsAPI } from './api.js';

function setupEvents() {
  const searchBox = document.getElementById('search-box');
  const clearButton = document.querySelector('.button-clear');
  const tagsWrap = document.querySelector('.search-results-container');

  clearButton.classList.add('button-clear--hidden'); // Hide clear button by default
  tagsWrap.classList.add('container-hide'); // Add "container-hide" class to hide tags container by default

  searchBox.addEventListener('focus', function () {
    if (searchBox.value.trim() !== '') {
      console.log('add')
      clearButton.classList.remove('button-clear--hidden');
      tagsWrap.classList.remove('container-hide'); // Add "container-hide" class to hide tags container by default
   
    } else {
      console.log('remove')
      clearButton.classList.add('button-clear--hidden');
      tagsWrap.classList.add('container-hide'); // Add "container-hide" class to hide tags container by default

    }
  });

  searchBox.addEventListener('blur', function(event) {
    // Small delay to allow for tag clicks to register
    setTimeout(() => {
      if (!tagsWrap.contains(document.activeElement)) {
        tagsWrap.classList.add('container-hide');
      }
    }, 200);
  });
  
  // Show or hide the clear button based on input value
  searchBox.addEventListener('input', async function () {
    if (searchBox.value.trim() !== '') {
      clearButton.classList.remove('button-clear--hidden');
      tagsWrap.classList.remove('container-hide'); // Add "container-hide" class to hide tags container by default

    } else {
      clearButton.classList.add('button-clear--hidden');
      tagsWrap.classList.add('container-hide'); // Add "container-hide" class to hide tags container by default

    }
    const keyword = searchBox.value.trim();
    if (keyword) {
      try {
        const tags = await getTagsAPI(keyword);
        const tagsContainer = document.querySelector('.search-tags-container');
        tagsContainer.innerHTML = ''; // Clear existing tags
        const sortedTags = tags.sort((a, b) => b.count - a.count);
        sortedTags.forEach(tagObj => {
          const tagElement = document.createElement('span');
          tagElement.className = 'search-tag';

          const tagNameElement = document.createElement('span');
          tagNameElement.className = 'search-tag-name';
          tagNameElement.textContent = tagObj.tag;

          const tagNumberElement = document.createElement('span');
          tagNumberElement.className = 'search-tag-number';
          tagNumberElement.textContent = `${tagObj.count}`;

          tagElement.appendChild(tagNameElement);
          tagElement.appendChild(tagNumberElement);
          tagsContainer.appendChild(tagElement);

          // Add click event listener to trigger search and populate input field
          tagElement.addEventListener('click', () => {
            searchBox.value = tagObj.tag;
            tagsWrap.classList.add('container-hide'); // Add "container-hide" class to hide tags container by default
            setCurrentPage(1); // Use the function to set currentPage
            loadImages(tagObj.tag, false);
          });
        });
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    }

  });

  // Clear the search box when the clear button is clicked
  clearButton.addEventListener('click', function () {
   searchBox.value = '';
    setCurrentPage(1); // Use the function to set currentPage
    clearButton.classList.add('button-clear--hidden');
    tagsWrap.classList.add('container-hide'); // Add "container-hide" class to hide tags container by default
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
