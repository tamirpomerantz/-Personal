
document.addEventListener('DOMContentLoaded', function() {
    const SCROLL_BOUND_TRIGGER = 400;
    let currentPage = 1;
    const gallery = document.getElementById('image-gallery');
    const searchBox = document.getElementById('search-box');
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTags = document.getElementById('modal-tags');
    const modalDescription = document.getElementById('modal-description');
    const closeModal = document.querySelector('.modal .close');
    const gap = 16; // gap in pixels between images
    let imagesData = []; // Store all images data
    let processedImagesCount = 0; // Track how many images have been processed
    let isFetching = false; // Flag to check if images are currently being fetched
    let isScrollTriggered = false;



    const clearButton = document.querySelector('.button-clear');
    clearButton.classList.add('button-clear--hidden'); // Hide the button by default

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
        loadImages("",false);
        // searchBox.focus(); // Optionally focus the input field after clearing
    });


    function loadImages(search, append = false) {
        const fetchingStatusDiv = document.getElementById('fetching-status');
        const endOfResultsStatusDiv = document.getElementById('end-of-results-status');
    
        if (isFetching) {
            console.log('isFetching');
            return; // Prevent multiple concurrent fetches
        }
    
        fetchingStatusDiv.style.display = 'block'; // Show fetching status
        setTimeout(() => { fetchingStatusDiv.style.display = 'none'; }, 1000); // Hide after 1 second
    
        isFetching = true; // Set flag to true to indicate fetching is underway
        console.log(`firing loadImages page ${currentPage} q=${search}`);
        return new Promise((resolve) => {
            fetch(`/api/images?page=${currentPage}&search=${search}`)
            .then(response => response.json())
            .then(data => {
                console.log(data);
                if (data.length > 0) {
                    if (!append) {
                        currentPage = 1;
                        gallery.innerHTML = ''; // Clear previous results if not appending
                        imagesData = [];
                        processedImagesCount = 0;
                    }
                    imagesData = imagesData.concat(data); // Append new data
                    arrangeImages(imagesData.slice(processedImagesCount)); // Arrange only new images
                    processedImagesCount += data.length; // Update count of processed images
                    currentPage++; // Prepare the next page number
                } else {
                    if (!append) {
                        currentPage = 1;
                        gallery.innerHTML = ''; // Clear previous results if not appending
                        imagesData = [];
                        processedImagesCount = 0;
                        console.log('no results!');
                    } else {
                        console.log('end of results');
                    }
                    endOfResultsStatusDiv.style.display = 'block'; // Show end of results status
                    setTimeout(() => { endOfResultsStatusDiv.style.display = 'none'; }, 1000); // Hide after 1 second
                }
                setTimeout(() => { 
                    isFetching = false;
                    resolve();
                }, 1000); // Reset fetch flag after 2 seconds
            })
            .catch(error => {
                console.error('Error fetching images:', error);
                isFetching = false;
                resolve();
            });
        });
    }
    
    function arrangeImages(newImages) {
        const galleryWidth = gallery.clientWidth; // Use the actual width of the gallery for the grid
        let currentRow = [];
        let accumulatedAspectRatio = 0;

        newImages.forEach(image => {
            const aspectRatio = image.width / image.height;

            // Decide whether to start a new row
            if ((aspectRatio > 2 && currentRow.length) || // wide image, place alone if not first
                (accumulatedAspectRatio + aspectRatio > 4 && currentRow.length >= 3)) { // too wide for current row
                placeRow(currentRow, galleryWidth, gap);
                currentRow = [];
                accumulatedAspectRatio = 0;
            }

            currentRow.push({...image, aspectRatio: aspectRatio});
            accumulatedAspectRatio += aspectRatio;
        });

        // Place the last row
        if (currentRow.length > 0) {
            placeRow(currentRow, galleryWidth, gap);
        }

        // Attach click events to the newly added images
        gallery.querySelectorAll('div[style]').forEach(imgDiv => {
            imgDiv.addEventListener('click', function() {
                const imageUrl = this.style.backgroundImage.slice(5, -2); // Extract the URL
                openImageModal(imageUrl);
            });
        });
    }

    function placeRow(row, totalWidth, gap) {
        const rowElement = document.createElement('div');
        rowElement.className = 'row'; // Add class for styling
        const numberOfGaps = row.length - 1;
        const widthAvailableForImages = totalWidth - (gap * numberOfGaps);
        const rowHeight = widthAvailableForImages / row.reduce((sum, img) => sum + img.aspectRatio, 0);

        row.forEach((img, index) => {
            const imgWidth = (img.aspectRatio / row.reduce((sum, img) => sum + img.aspectRatio, 0)) * widthAvailableForImages;
            const imgElement = document.createElement('div');
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

    function openImageModal(imageUrl) {
        // Set the image as the background of the modal div
        modalImage.style.backgroundImage = `url("${imageUrl}")`;
        modalImage.style.backgroundSize = 'contain';
        modalImage.style.backgroundPosition = 'center';
        modalImage.style.backgroundRepeat = 'no-repeat';
    
        // Initialize Panzoom on the modalImage
        const panzoomInstance = panzoom(modalImage, {
            maxScale: 5, // Maximum zoom level
            contain: 'outside' // Allow panning outside the bounds
        });
    
        // Add event listeners for zooming
        modalImage.addEventListener('wheel', panzoomInstance.zoomWithWheel);
    
        // Decode the image name from the URL
        const imageName = decodeURIComponent(imageUrl).split('/').pop();
    
        // Encode the image name to safely send in the URL
        fetch(`/image-info?imageName=${encodeURIComponent(imageName)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Image not found');
                }
                return response.json();
            })
            .then(data => {
                // Set the description and tags
                modalDescription.textContent = data.context || 'No description available';
                modalTags.innerHTML = ''; // Clear previous tags
    
                if (data.tags && Array.isArray(data.tags)) {
                    data.tags.forEach(tag => {
                        const tagElement = document.createElement('span');
                        tagElement.textContent = tag;
                        tagElement.classList.add('tag');
                        tagElement.addEventListener('click', () => {
                            modal.style.display = 'none'; // Close the modal
                            searchBox.value = tag; // Enter the tag in the search box
                            loadImages(tag, false); // Trigger search with the tag
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
    }
    

    // Close modal when "X" is clicked
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicked outside of it
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    window.addEventListener('resize', function() {
        // Recalculate layout for all images on resize
        gallery.innerHTML = '';
        processedImagesCount = 0;
        arrangeImages(imagesData);
    });

    let lastScrollTop = 0; // Variable to store the last scroll position

    window.addEventListener('scroll', () => {
        const currentScrollTop = window.scrollY;
    
        // Check if the user is scrolling down
        if (currentScrollTop > lastScrollTop) {
            if (!isScrollTriggered && !isFetching && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - SCROLL_BOUND_TRIGGER) {
                isScrollTriggered = true;
                loadImages(searchBox.value.trim(), true).then(() => {
                    isScrollTriggered = false;
                    // Check if we're still at the bottom after loading
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - SCROLL_BOUND_TRIGGER) {
                        window.dispatchEvent(new Event('scroll'));  // Trigger the scroll event again
                    }
                });
            }
        }
    
        lastScrollTop = currentScrollTop; // Update the last scroll position
    });

    window.searchImages = function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            isFetching = false;
            loadImages(event.target.value.trim(), false); // New search, not appending
        }
    };

    // Initial load of images
    loadImages('', false);
});