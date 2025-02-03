let pageSize = 10;  // You can set this to any number you prefer


document.getElementById('search-box').addEventListener('input', function(e) {
    let input = e.target.value;
    if (!input) return closeAllLists();
    let list = document.getElementById("autocomplete-list");
    list.innerHTML = '';

    fetch(`/autocomplete?keyword=${input}`)
        .then(response => response.json())
        .then(tags => {
            tags.forEach(tag => {
                let item = document.createElement("DIV");
                item.innerHTML = `<strong>${tag.substr(0, input.length)}</strong>${tag.substr(input.length)}`;
                item.addEventListener("click", function() {
                    document.getElementById('search-box').value = tag;
                    closeAllLists();
                    filterImages(tag);
                });
                list.appendChild(item);
            });
        });
});
// ... existing code ...

function setUpAutocomplete() {
    const searchBox = document.getElementById('search-box');
    searchBox.addEventListener('input', onSearchInput);
    searchBox.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            // Prevent the default form submission if it's inside a form
            e.preventDefault();
            searchImages(this.value);
        }
    });
}

function searchImages(query) {
    if (!query.trim()) return;

    window.history.pushState({ query }, '', `/?search=${encodeURIComponent(query)}`);
    fetch(`/search?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(images => {
            distributeImages(images);
        });
}

// Existing setUpAutocomplete and onSearchInput functions...


function onSearchInput(e) {
    let input = e.target.value;
    if (!input) return closeAllLists();
    let list = document.getElementById("autocomplete-list");
    if (!list) {
        // Re-create the autocomplete list if it doesn't exist.
        list = document.createElement('ul');
        list.setAttribute('id', 'autocomplete-list');
        list.setAttribute('class', 'autocomplete-items');
        this.parentNode.appendChild(list);
    }
    list.innerHTML = '';

    // ... fetch autocomplete data and the rest of the function ...
}

// Call this function after content is dynamically loaded to ensure the search box is set up correctly.
function contentLoaded() {
    setUpAutocomplete();
    // waterfall('#waterfall-container');
    // Any other initialization code for dynamic content.
}


function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', function() {


// Event delegation to handle image click for all images
document.querySelector('.image-grid').addEventListener('click', function(event) {
    if (event.target.tagName === 'IMG') {
        const imageUrl = new URL(event.target.src);
        const imageName = imageUrl.pathname.split('/').pop(); // Extract image name from src
        const encodedImageName = encodeURIComponent(imageName);

        fetch(`/image-info?imageName=${encodedImageName}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Image not found: ${imageName}`);
                }
                return response.json();
            })
            .then(data => {
                openModal(event.target.src, data.context, data.tags);
            })
            .catch(error => {
                console.error(error);
                // Handle the error, maybe show a user-friendly message
            });
    }
});


function openModal(imageSrc, imageContext, imageTags) {
    const imageModal = document.getElementById('imageModal');
    const modalImageDiv = document.querySelector('.modal-image'); // Access the div instead of img
    const imageDescription = document.getElementById('imageDescription');
    const modalTags = document.getElementById('modalTags');

    // Update the modal image as a background image
    modalImageDiv.style.backgroundImage = `url('${imageSrc}')`;
    modalImageDiv.style.backgroundSize = 'contain';
    modalImageDiv.style.backgroundRepeat = 'no-repeat';
    modalImageDiv.style.backgroundPosition = 'center center';
    modalImageDiv.style.height = '90vh'; // Set the div height to maintain aspect ratio

    // Exclude the <tags> content from context
   
 // Exclude the <tags> content from context
 const cleanedContext = imageContext.replace(/<tags>.*<\/tags>/s, '').trim();

 // Update the modal description
 imageDescription.innerText = cleanedContext;

    // Clear old tags and add new ones
    modalTags.innerHTML = '';
    imageTags.forEach(tag => {
        let span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        span.onclick = function() { filterImages(tag); };
        modalTags.appendChild(span);
    });

    // Show the modal
    imageModal.style.display = 'block';
}


    // Close the modal
    document.querySelector('.close').onclick = function() {
        document.getElementById('imageModal').style.display = 'none';
    };
    
    // Close the modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target === document.getElementById('imageModal')) {
            document.getElementById('imageModal').style.display = 'none';
        }
    };
});


// On initial page load, set up the autocomplete.
document.addEventListener('DOMContentLoaded', contentLoaded);

// When dynamically loading content after clicking a tag:
// Instead of just `filterImages(tag);`, you'd use:
function onTagClick(tag) {
    filterImages(tag).then(contentLoaded); // Assuming filterImages returns a Promise.
}

// ... the rest of your existing script ...

function closeAllLists(elmnt) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
        if (elmnt != x[i] && elmnt != document.getElementById('search-box')) {
            x[i].parentNode.removeChild(x[i]);
        }
    }
}

document.addEventListener("click", function (e) {
    closeAllLists(e.target);
});

window.onpopstate = function(event) {
    if (event.state) {
        if (event.state.tag) {
            filterImages(event.state.tag);
        } else if (event.state.query) {
            searchImages(event.state.query);
        }
    } else {
        // Reload the initial state or handle the absence of any state
        document.location.reload();
    }
};


window.addEventListener('scroll', () => {
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight) {
        loadMoreImages();
    }
});

let currentPage = 1;
let currentTag = '';

function loadMoreImages() {
    if (!currentTag) {
        currentPage++;
        fetch(`/?page=${currentPage}`)
            .then(response => response.text())
            .then(html => appendImages(html))
    }
}

function distributeImages(images) {
    const column1 = document.querySelector('#column1');
    const column2 = document.querySelector('#column2');
    column1.innerHTML = '';
    column2.innerHTML = '';
    
    images.forEach((image, index) => {
        const imageHTML = `
            <div class="image-card">
                <img src="/photos/${image.src}" alt="Image">
            </div>
        `;
        // console.log(index)
        if (index % 2 == 0) {
            column1.innerHTML += imageHTML;
        } else {
            column2.innerHTML += imageHTML;
        }
    });
}
function appendImages(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('.image-card'));

    console.log(images)
    const imageContainer = document.querySelector('#imageContainer');
    // const column2 = document.querySelector('#column2');

    // Calculate the starting index based on the current page number
    let globalIndex = (currentPage - 1) * pageSize;
    
    images.forEach((image, index) => {
        // Use globalIndex to determine the
        column1.appendChild(image);
        // correct column
        if ((globalIndex + index) % 2 === 0) {
            column1.appendChild(image);
        } else {
            column2.appendChild(image);
        }
    });
}


function filterImages(tag) {
  
    currentTag = tag;
    window.history.pushState({ tag }, '', `/?tag=${tag}`);

    fetch(`/filter?tag=${tag}`)
    .then(response => response.json())
    .then(images => {
        (distributeImages(images))});
    closeModal();
}

