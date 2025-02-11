// public/js/gallery.js
let isFetching = false;
let hasMoreImages = true;
let currentSearch = '';
let currentShuffle = false;
const gallery = document.getElementById('image-gallery');
const gap = 16; // Gap in pixels between images

export const loadImages = async (search = '', shuffle = false, isNewSearch = false) => {
  // Don't fetch if already fetching
  if (isFetching) return;

  // If it's a new search, reset everything
  if (isNewSearch) {
    gallery.innerHTML = '';
    hasMoreImages = true;
    currentSearch = search;
    currentShuffle = shuffle;
  }

  // Don't fetch if we know there are no more images
  if (!hasMoreImages) return;

  isFetching = true;
  showFetchingStatus();

  try {
    // Get the current number of images to use as offset
    const offset = gallery.querySelectorAll('div[style]').length;
    const response = await fetch(`/api/images?offset=${offset}&search=${encodeURIComponent(search)}&shuffle=${shuffle}`);
    const data = await response.json();

    if (!data.images || data.images.length === 0) {
      hasMoreImages = false;
      if (offset === 0) {
        gallery.innerHTML = '<div class="no-results">No images found</div>';
      }
      showEndOfResultsStatus();
      return;
    }

    // Update hasMoreImages based on server response
    hasMoreImages = data.hasMore;

    // Append new images to gallery
    arrangeImages(data.images);

    // If no more images, show end of results
    if (!hasMoreImages) {
      showEndOfResultsStatus();
    }
  } catch (error) {
    console.error('Error loading images:', error);
  } finally {
    isFetching = false;
    hideFetchingStatus();
  }
};

function arrangeImages(images) {
  const galleryWidth = gallery.clientWidth;
  let currentRow = [];
  let accumulatedAspectRatio = 0;

  images.forEach(image => {
    const aspectRatio = image.width / image.height;
    // Decide when to start a new row
    if ((aspectRatio > 2 && currentRow.length) ||
        (accumulatedAspectRatio + aspectRatio > 4 && currentRow.length >= 3)) {
      placeRow(currentRow, galleryWidth, gap);
      currentRow = [];
      accumulatedAspectRatio = 0;
    }
    currentRow.push({ ...image, aspectRatio: aspectRatio });
    accumulatedAspectRatio += aspectRatio;
  });

  if (currentRow.length > 0) {
    placeRow(currentRow, galleryWidth, gap);
  }
  initializeImagesInView();
}

function placeRow(row, totalWidth, gap) {
  const rowElement = document.createElement('div');
  rowElement.className = 'row';
  const numberOfGaps = row.length - 1;
  const widthAvailableForImages = totalWidth - (gap * numberOfGaps);
  const totalAspect = row.reduce((sum, img) => sum + img.aspectRatio, 0);
  const rowHeight = widthAvailableForImages / totalAspect;

  row.forEach((img, index) => {
    const imgWidth = (img.aspectRatio / totalAspect) * widthAvailableForImages;
    const imgElement = document.createElement('div');
    imgElement.className = `hover-int-${(index % 4) + 1}`;
    imgElement.style.backgroundImage = `url("${img.src}")`;
    imgElement.style.width = `${imgWidth}px`;
    imgElement.style.height = `${rowHeight}px`;
    imgElement.style.backgroundSize = 'cover';
    if (index < row.length - 1) {
      imgElement.style.marginRight = `${gap}px`;
    }

    imgElement.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('openModal', { detail: img.src }));
    });

    rowElement.appendChild(imgElement);
  });
  gallery.appendChild(rowElement);
}

function initializeImagesInView() {
  const imagesInView = Array.from(gallery.querySelectorAll('div[style]')).map(imgDiv =>
    imgDiv.style.backgroundImage.slice(5, -2)
  );
  window.dispatchEvent(new CustomEvent('imagesInView', { detail: imagesInView }));
}

// Scroll handler with debounce
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const bodyHeight = document.body.offsetHeight;
    const scrollThreshold = bodyHeight - (window.innerHeight * 2); // Load more when 2 viewport heights away from bottom

    if (scrollPosition >= scrollThreshold && !isFetching && hasMoreImages) {
      loadImages(currentSearch, currentShuffle, false);
    }
  }, 100);
});

// Resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (gallery && gallery.children.length > 0) {
      const existingImages = Array.from(gallery.querySelectorAll('div[style]')).map(imgDiv => {
        const url = imgDiv.style.backgroundImage.slice(5, -2);
        const width = parseFloat(imgDiv.style.width);
        const height = parseFloat(imgDiv.style.height);
        return { src: url, width, height, aspectRatio: width / height };
      });
      gallery.innerHTML = '';
      arrangeImages(existingImages);
    }
  }, 250);
});

function showFetchingStatus() {
  const status = document.getElementById('fetching-status');
  status.style.display = 'block';
  setTimeout(() => { status.style.display = 'none'; }, 1000);
}

function showEndOfResultsStatus() {
  const status = document.getElementById('end-of-results-status');
  status.style.display = 'block';
  setTimeout(() => { status.style.display = 'none'; }, 1000);
}

function hideFetchingStatus() {
  document.getElementById('fetching-status').style.display = 'none';
}

