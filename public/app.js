
document.addEventListener('DOMContentLoaded', function() {
    /* ===================================================
       1. VARIABLE & ELEMENT INITIALIZATION
       =================================================== */
    const SCROLL_BOUND_TRIGGER = 400;
    let currentPage = 1;
    let imagesData = [];            // Store all images data
    let processedImagesCount = 0;   // Track how many images have been processed
    let isFetching = false;         // Flag to check if images are currently being fetched
    let isScrollTriggered = false;  // Flag to prevent multiple scroll-triggered loads

    // DOM elements
    const gallery = document.getElementById('image-gallery');
    const searchBox = document.getElementById('search-box');
    const modal = document.getElementById('image-modal');
    const modalContent = document.querySelector('.modal-content');
    const modalImage = document.getElementById('modal-image');
    const modalTags = document.getElementById('modal-tags');
    const modalDescription = document.getElementById('modal-description');
    const ImageBGpalette = [  "#E1F2D9","#E4E6FE","#EEEEEE","#FED4E9","#FEE2BA","#FFECBA"];

    modalDescription.setAttribute('contenteditable', 'true');
    // modalDescription.addEventListener('blur', function() {
    //     updateDescription();
    //     modalDescription.classList.add('updating'); // Add .updating class
    //     setTimeout(() => {
    //         modalDescription.classList.remove('updating'); // Remove .updating class after 1 second
    //     }, 1000);
    // });
    modalDescription.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default Enter behavior (new line)
            updateDescription();
            modalDescription.classList.add('updating'); // Add .updating class
            setTimeout(() => {
                modalDescription.classList.remove('updating'); // Remove .updating class after 1 second
            }, 1000);
        }
    });
// Function to update the description using the backend API
function updateDescription() {
    const newDescription = modalDescription.textContent.trim();
    const imageName = decodeURIComponent(modalImage.style.backgroundImage.slice(5, -2)).split('/').pop();

    fetch(`/api/images/${encodeURIComponent(imageName)}/description`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description: newDescription })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update description');
        }
        return response.json();
    })
    .then(data => {
        console.log(data.message);
    })
    .catch(error => {
        console.error('Error updating description:', error);
    });
    modalDescription.blur(); // Remove focus from the element

}

    const closeModal = document.querySelector('.modal .close');
    const gap = 16; // Gap in pixels between images

    // Clear button setup
    const clearButton = document.querySelector('.button-clear');
    clearButton.classList.add('button-clear--hidden'); // Hide the button by default

    /* ===================================================
       2. SEARCH BOX & CLEAR BUTTON EVENTS
       =================================================== */
    // Show or hide the clear button based on input value
    searchBox.addEventListener('input', function() {
        if (searchBox.value.trim() !== '') {
            clearButton.classList.remove('button-clear--hidden');
        } else {
            clearButton.classList.add('button-clear--hidden');
        }
    });

    // Clear the search box when the clear button is clicked
    clearButton.addEventListener('click', function() {
        searchBox.value = '';
        clearButton.classList.add('button-clear--hidden');
        loadImages("", false);
        // searchBox.focus(); // Optionally focus the input field after clearing
    });

    let FetchIsRandom = false;

        // Add event listener for the random toggle button
        const randomToggleButton = document.getElementById('random-toggle');
        randomToggleButton.addEventListener('click', function() {
            FetchIsRandom = !FetchIsRandom; // Toggle the random state
    
            // Update the icon based on the current state
            if (FetchIsRandom) {
                randomToggleButton.classList.add('active-toggle');
            } else {
                randomToggleButton.classList.remove('active-toggle');
            }
            // Optionally, reload images with the new random state
            currentPage = 1;
            loadImages(searchBox.value.trim(), false, FetchIsRandom);
        });


    /* ===================================================
       3. IMAGE LOADING & ARRANGEMENT FUNCTIONS
       =================================================== */
    // Load images from the server with optional search term and append mode
    function loadImages(search, append = false, isRandom = FetchIsRandom) {
        const fetchingStatusDiv = document.getElementById('fetching-status');
        const endOfResultsStatusDiv = document.getElementById('end-of-results-status');
    
        if (isFetching) {
            console.log('isFetching');
            return; // Prevent multiple concurrent fetches
        }
    
        // Show fetching status briefly
        fetchingStatusDiv.style.display = 'block';
        setTimeout(() => { fetchingStatusDiv.style.display = 'none'; }, 1000);
    
        isFetching = true; // Set flag to indicate fetching is underway
        console.log(`firing loadImages page ${currentPage} q=${search} shuffle=${isRandom}`);
        return new Promise((resolve) => {
            fetch(`/api/images?page=${currentPage}&search=${search}&shuffle=${isRandom}`)
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    if (data.length > 0) {
                        if (!append) {
                            // New search: reset the gallery and counters
                            currentPage = 1;
                            gallery.innerHTML = '';
                            imagesData = [];
                            processedImagesCount = 0;
                        }
                        imagesData = imagesData.concat(data); // Append new data
                        arrangeImages(imagesData.slice(processedImagesCount)); // Arrange only new images
                        processedImagesCount += data.length; // Update count of processed images
                        currentPage++; // Prepare the next page number
                    } else {
                        // No results found
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
                    // Reset fetching flag after a brief delay
                    setTimeout(() => { 
                        isFetching = false;
                        resolve();
                    }, 1000);
                })
                .catch(error => {
                    console.error('Error fetching images:', error);
                    isFetching = false;
                    resolve();
                });
        });
    }
    // Arrange new images into rows based on their aspect ratios
    function arrangeImages(newImages) {
        const galleryWidth = gallery.clientWidth; // Use the actual width of the gallery for the grid
        let currentRow = [];
        let accumulatedAspectRatio = 0;

        newImages.forEach(image => {
            const aspectRatio = image.width / image.height;

            // Decide whether to start a new row based on image width and row content
            if ((aspectRatio > 2 && currentRow.length) || // Wide image, place alone if not first
                (accumulatedAspectRatio + aspectRatio > 4 && currentRow.length >= 3)) { // Too wide for current row
                placeRow(currentRow, galleryWidth, gap);
                currentRow = [];
                accumulatedAspectRatio = 0;
            }

            // Add image (with its aspect ratio) to the current row
            currentRow.push({ ...image, aspectRatio: aspectRatio });
            accumulatedAspectRatio += aspectRatio;
        });

        // Place the last row if any images remain
        if (currentRow.length > 0) {
            placeRow(currentRow, galleryWidth, gap);
        }
        initializeImagesInView();

        // Attach click events to the newly added images for opening the modal
        gallery.querySelectorAll('div[style]').forEach(imgDiv => {
            imgDiv.addEventListener('click', function() {
                const imageUrl = this.style.backgroundImage.slice(5, -2); // Extract the URL from style
                openImageModal(imageUrl);
            });
        });
    }
    
    // Create and append a row of images with calculated dimensions
    function placeRow(row, totalWidth, gap) {
        const rowElement = document.createElement('div');
        rowElement.className = 'row'; // Add class for styling
        const numberOfGaps = row.length - 1;
        const widthAvailableForImages = totalWidth - (gap * numberOfGaps);
        const rowHeight = widthAvailableForImages / row.reduce((sum, img) => sum + img.aspectRatio, 0);

        row.forEach((img, index) => {
            const imgWidth = (img.aspectRatio / row.reduce((sum, img) => sum + img.aspectRatio, 0)) * widthAvailableForImages;
            const imgElement = document.createElement('div');
            // Add a random hover effect class (hover-int-1 to hover-int-4)
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

    /* ===================================================
       4. MODAL FUNCTIONALITY
       =================================================== */
    // Open the modal with the selected image and fetch its details
  
let currentImageIndex = 0;
let imagesInView = [];

// Function to open the image modal and set up navigation
function openImageModal(imageUrl) {
    // Set modal image styles
    modalImage.style.backgroundImage = `url("${imageUrl}")`;
    modalImage.style.backgroundSize = 'contain';
    modalImage.style.backgroundPosition = 'center';
    modalImage.style.backgroundRepeat = 'no-repeat';

    // Initialize Panzoom on the modal image for zooming and panning
    const panzoomInstance = panzoom(modalImage, {
        maxScale: 5,       // Maximum zoom level
        contain: 'inside'  // Prevent panning outside the bounds
    });

    // Add zooming with the mouse wheel
    modalImage.addEventListener('wheel', panzoomInstance.zoomWithWheel);

    // Decode the image name from the URL
    const imageName = decodeURIComponent(imageUrl).split('/').pop();

    // Fetch image info
    fetch(`/image-info?imageName=${encodeURIComponent(imageName)}`)
    .then(response => {
        if (!response.ok) {
            throw new Error('Image not found');
        }
        return response.json();
    })
    .then(data => {
        // Set modal description and tags
        modalDescription.textContent = data.context || 'No description available';

        modalTags.innerHTML = ''; // Clear previous tags

        if (data.tags && Array.isArray(data.tags)) {
            data.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                const textSpan = document.createElement('span');
                textSpan.textContent = tag;
                textSpan.classList.add('tag-text');

                tagElement.appendChild(textSpan);
                tagElement.classList.add('tag');

                // Create a remove div for each tag
                const removeDiv = document.createElement('div');
                removeDiv.innerHTML = feather.icons['x'].toSvg({ width: 16, height: 16 });
                removeDiv.classList.add('remove-tag-div');
                removeDiv.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent triggering the tag click event
                    removeTag(imageName, tag, tagElement); // Call the remove function
                });

                // Append the remove div to the tag element
                tagElement.appendChild(removeDiv);
                // Allow clicking a tag to search for that tag
                tagElement.addEventListener('click', () => {
                    modal.style.display = 'none'; // Close the modal
                    searchBox.value = tag;         // Populate search box with the tag
                    loadImages(tag, false);        // Trigger a new search with the tag
                });

                modalTags.appendChild(tagElement);
            });
        } else {
            modalTags.textContent = 'No tags available';
        }

        // Display the modal
        modal.style.display = 'block';
    })
    .catch(error => {
        console.error('Error fetching image info:', error);
        modalDescription.textContent = 'Error fetching image information.';
        modalTags.innerHTML = ''; // Clear previous tags
    });

    // Change modal background color based on the key color of the image
    const imgElement = new Image();
    imgElement.src = imageUrl;




    getKeyColor(imgElement,ImageBGpalette).then(color => {
        modalContent.style.backgroundColor = color.closestMatch;
    }).catch(error => {
        modalContent.style.backgroundColor = "var(--color-primary-background)";
        console.error('Error getting key color:', error);
    });

    // Set up arrow key navigation
    window.addEventListener('keydown', handleArrowKeys);
}

// Function to handle arrow key navigation
function handleArrowKeys(event) {
    if (document.activeElement !== modalDescription) {
        if (event.key === 'ArrowRight') {
            currentImageIndex = (currentImageIndex + 1) % imagesInView.length;
            openImageModal(imagesInView[currentImageIndex]);
        } else if (event.key === 'ArrowLeft') {
            currentImageIndex = (currentImageIndex - 1 + imagesInView.length) % imagesInView.length;
            openImageModal(imagesInView[currentImageIndex]);
        }
    }
}

// Function to initialize images in view
function initializeImagesInView() {
    imagesInView = Array.from(gallery.querySelectorAll('div[style]')).map(imgDiv => {
        return imgDiv.style.backgroundImage.slice(5, -2); // Extract the URL from style
    });
}
    // Close modal when the close ("X") button is clicked
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside the modal content
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
// Function to remove a tag using the API
function removeTag(imageName, tag, tagElement) {
    fetch(`/api/images/${encodeURIComponent(imageName)}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to remove tag');
        }
        return response.json();
    })
    .then(data => {
        console.log(data.message);
        // Remove the tag element from the DOM
        tagElement.remove();
    })
    .catch(error => {
        console.error('Error removing tag:', error);
    });
}
    /* ===================================================
       5. WINDOW EVENTS: RESIZE & SCROLL
       =================================================== */
    // Recalculate image layout on window resize
    window.addEventListener('resize', function() {
        gallery.innerHTML = '';
        processedImagesCount = 0;
        arrangeImages(imagesData);
    });

    // Infinite scroll: load more images when nearing the bottom
    let lastScrollTop = 0; // Track the last scroll position

    window.addEventListener('scroll', () => {
        const currentScrollTop = window.scrollY;
    
        // If scrolling down and near the bottom of the page
        if (currentScrollTop > lastScrollTop) {
            if (!isScrollTriggered && !isFetching && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - SCROLL_BOUND_TRIGGER) {
                isScrollTriggered = true;
                loadImages(searchBox.value.trim(), true).then(() => {
                    isScrollTriggered = false;
                    // If still near the bottom after loading, trigger scroll event again
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - SCROLL_BOUND_TRIGGER) {
                        window.dispatchEvent(new Event('scroll'));
                    }
                });
            }
        }
    
        lastScrollTop = currentScrollTop; // Update last scroll position
    });

    /* ===================================================
       6. SEARCH FUNCTIONALITY (ENTER KEY)
       =================================================== */
    window.searchImages = function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            isFetching = false;
            loadImages(event.target.value.trim(), false); // Trigger a new search (not appending)
        }
    };

    /* ===================================================
       7. INITIAL IMAGE LOAD
       =================================================== */
    // Start by loading images without any search term
    loadImages('', false);
});