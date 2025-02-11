// public/js/events.js
import { loadImages } from './gallery.js';

export function setupEvents() {
  const searchBox = document.getElementById('search-box');
  const clearButton = document.querySelector('.button-clear');
  const searchResultsContainer = document.querySelector('.search-results-container');
  const searchTagsContainer = document.querySelector('.search-tags-container');

  let debounceTimeout;

  clearButton.classList.add('button-clear--hidden');
  searchResultsContainer.classList.add('container-hide');

  searchBox.addEventListener('focus', function () {
    if (searchBox.value.trim() !== '') {
      clearButton.classList.remove('button-clear--hidden');
      searchResultsContainer.classList.remove('container-hide');
    } else {
      clearButton.classList.add('button-clear--hidden');
      searchResultsContainer.classList.add('container-hide');
    }
  });

  searchBox.addEventListener('blur', function(event) {
    setTimeout(() => {
      if (!searchResultsContainer.contains(document.activeElement)) {
        searchResultsContainer.classList.add('container-hide');
      }
    }, 200);
  });
  
  searchBox.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    clearButton.classList.toggle('button-clear--hidden', !query);
    searchResultsContainer.classList.toggle('container-hide', !query);

    if (query) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          const response = await fetch(`/api/get-tags?keyword=${encodeURIComponent(query)}`);
          const tags = await response.json();
          
          searchTagsContainer.innerHTML = '';
          
          tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'search-tag';
            tagElement.innerHTML = `
              <div class="search-tag-name">${tag.tag}</div>
              <div class="search-tag-number">${tag.count}</div>
            `;
            
            tagElement.addEventListener('click', () => {
              searchBox.value = tag.tag;
              loadImages(tag.tag, false, true);
              searchResultsContainer.classList.add('container-hide');
            });
            
            searchTagsContainer.appendChild(tagElement);
          });
        } catch (error) {
          console.error('Error fetching tags:', error);
        }
      }, 300);
    } else {
      loadImages('', false, true);
    }
  });

  clearButton.addEventListener('click', () => {
    searchBox.value = '';
    clearButton.classList.add('button-clear--hidden');
    searchResultsContainer.classList.add('container-hide');
    loadImages('', false, true);
  });

  const randomToggle = document.getElementById('random-toggle');
  randomToggle.addEventListener('click', () => {
    randomToggle.classList.toggle('active-toggle');
    const isRandom = randomToggle.classList.contains('active-toggle');
    loadImages(searchBox.value.trim(), isRandom, true);
  });

  window.addEventListener('searchTag', (e) => {
    searchBox.value = e.detail;
    loadImages(e.detail, false, true);
  });

  const mainTitle = document.querySelector('.main-title');
  mainTitle.addEventListener('animationend', function() {
    mainTitle.classList.add('animation-complete');
  });

  // Initial load
  loadImages('', false, true);
}
