// public/js/gallery.js
let currentPage = 1;
let imagesData = [];            // All loaded images
let processedImagesCount = 0;   // Count of images already arranged in the gallery
let isFetching = false;
let FetchIsRandom = false;      // Determines whether to randomize results

const gallery = document.getElementById('image-gallery');
const SCROLL_BOUND_TRIGGER = 400;
const gap = 16; // Gap in pixels between images


function loadImages(search, append = false, isRandom = FetchIsRandom) {
  const fetchingStatusDiv = document.getElementById('fetching-status');
  const endOfResultsStatusDiv = document.getElementById('end-of-results-status');

  if (isFetching) {
    console.log('isFetching');
    return Promise.resolve();
  }

  fetchingStatusDiv.style.display = 'block';
  setTimeout(() => { fetchingStatusDiv.style.display = 'none'; }, 1000);
  isFetching = true;
  console.log(`firing loadImages page ${currentPage} q=${search} shuffle=${isRandom}`);

  return fetch(`/api/images?page=${currentPage}&search=${search}&shuffle=${isRandom}`)
    .then(response => response.json())
    .then(data => {
      console.log(data);
      if (data.length > 0) {
        if (!append) {
          // New search: reset gallery and counters.
          currentPage = 1;
          gallery.innerHTML = '';
          imagesData = [];
          processedImagesCount = 0;
        }
        imagesData = imagesData.concat(data);
        arrangeImages(imagesData.slice(processedImagesCount));
        processedImagesCount += data.length;
        currentPage++;
      } else {
        // No results found.
        if (!append) {
          currentPage = 1;
          gallery.innerHTML = '';
          imagesData = [];
          processedImagesCount = 0;
          console.log('no results!');
        } else {
          console.log('end of results');
        }
        endOfResultsStatusDiv.style.display = 'block';
        setTimeout(() => { endOfResultsStatusDiv.style.display = 'none'; }, 1000);
      }
      setTimeout(() => {
        isFetching = false;
      }, 1000);
    })
    .catch(error => {
      console.error('Error fetching images:', error);
      isFetching = false;
    });
}

function arrangeImages(newImages) {
  const galleryWidth = gallery.clientWidth;
  let currentRow = [];
  let accumulatedAspectRatio = 0;

  newImages.forEach(image => {
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

  // Attach click events to each image in the gallery.
  gallery.querySelectorAll('div[style]').forEach(imgDiv => {
    imgDiv.addEventListener('click', function () {
      const imageUrl = this.style.backgroundImage.slice(5, -2); // Extract URL from style
      // Dispatch a custom event to open the modal.
      const event = new CustomEvent('openModal', { detail: imageUrl });
      window.dispatchEvent(event);
    });
  });
}


function setCurrentPage(page) {
  currentPage = page;
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
    // Add a random hover effect class
    const randomClass = `hover-int-${Math.floor(Math.random() * 4) + 1}`;
    imgElement.classList.add(randomClass);
    imgElement.style.backgroundImage = `url("${img.src}")`;
    imgElement.style.width = `${imgWidth}px`;
    imgElement.style.height = `${rowHeight}px`;
    imgElement.style.backgroundSize = 'cover';
    imgElement.style.display = 'inline-block';
    imgElement.style.verticalAlign = 'bottom';
    if (index < row.length - 1) {
      imgElement.style.marginRight = `${gap}px`;
    }
    rowElement.appendChild(imgElement);
  });
  gallery.appendChild(rowElement);
}

function initializeImagesInView() {
  // Gather all image URLs from the gallery (for modal navigation, if needed)
  const imagesInView = Array.from(gallery.querySelectorAll('div[style]')).map(imgDiv =>
    imgDiv.style.backgroundImage.slice(5, -2)
  );
  // Dispatch a custom event so other modules (e.g. modal navigation) can use this array.
  window.dispatchEvent(new CustomEvent('imagesInView', { detail: imagesInView }));
}

export { loadImages, arrangeImages, setCurrentPage };

