// public/js/modal.js
import { addTagAPI, updateDescriptionAPI, removeTagAPI } from './api.js';
import { isColorDarkerThanGray, getKeyColor } from './utils.js';

let modal, modalContent, modalImage, modalTags, modalDescription, addTagButton, searchBox, retagButton;

function setupModal() {
  // Cache DOM elements for the modal and related UI controls
  modal = document.getElementById('image-modal');
  modalContent = document.querySelector('.modal-content');
  modalImage = document.getElementById('modal-image');
  modalTags = document.getElementById('modal-tags');
  modalDescription = document.getElementById('modal-description');
  addTagButton = document.getElementById('addtagbutton');
  searchBox = document.getElementById('search-box');
  retagButton = document.getElementById('retag-button');

  // Set up retag button functionality
  retagButton.addEventListener('click', handleRetag);

  // Make the description editable and update on Enter (without adding a newline)
  modalDescription.setAttribute('contenteditable', 'true');
  modalDescription.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      updateDescription();
      modalDescription.classList.add('updating');
      setTimeout(() => {
        modalDescription.classList.remove('updating');
      }, 1000);
    }
  });

  // Set up the add tag button UI and events
  const ADD_TAG_BUTTON_UI = "Add tag";
  addTagButton.textContent = ADD_TAG_BUTTON_UI;
  addTagButton.setAttribute('contenteditable', 'true');
  addTagButton.addEventListener('focus', function () {
    if (addTagButton.textContent === ADD_TAG_BUTTON_UI) {
      addTagButton.textContent = '';
    }
    // Move the cursor to the end of the content
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(addTagButton);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  addTagButton.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addTag();
    }
  });
  addTagButton.addEventListener('blur', function () {
    setTimeout(() => {
      addTagButton.textContent = ADD_TAG_BUTTON_UI;
    }, 200);
  });

  // Close modal when the close ("X") button is clicked
  const closeModalBtn = document.querySelector('.modal .close');
  closeModalBtn.addEventListener('click', () => {
    modal.classList.add('modal-hide');
  });
  // Close modal when clicking outside the modal content
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.classList.add('modal-hide');
    }
  });
}

async function handleRetag() {
  const imageName = decodeURIComponent(modalImage.style.backgroundImage.slice(5, -2)).split('/').pop();
  retagButton.disabled = true;
  retagButton.innerHTML = '<i data-feather="loader"></i> Generating...';
  feather.replace();

  try {
    const response = await fetch('/api/retag-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageName }),
    });

    if (!response.ok) throw new Error('Failed to retag image');
    
    const data = await response.json();
    
    // Update the UI with new tags
    modalTags.innerHTML = '';
    data.tags.forEach(tag => {
      const tagElement = createTagElement(imageName, tag);
      modalTags.insertBefore(tagElement, modalTags.firstChild);
    });
    modalTags.appendChild(addTagButton);
    
    // Update description
    modalDescription.textContent = data.context;
    
    // Hide retag button since image is now tagged
    retagButton.style.display = 'none';
  } catch (error) {
    console.error('Error retagging image:', error);
    alert('Failed to retag image. Please try again.');
  } finally {
    retagButton.disabled = false;
    retagButton.innerHTML = '<i data-feather="refresh-cw"></i> Generate AI Tags';
    feather.replace();
  }
}

function openImageModal(imageUrl) {
  // Set modal image styles
  modalImage.style.backgroundImage = `url("${imageUrl}")`;
  modalImage.style.backgroundSize = 'contain';
  modalImage.style.backgroundPosition = 'center';
  modalImage.style.backgroundRepeat = 'no-repeat';

  // Initialize Panzoom on the modal image (assuming panzoom is available globally)
  const panzoomInstance = panzoom(modalImage, {
    maxScale: 5,
    contain: 'inside'
  });
  modalImage.addEventListener('wheel', panzoomInstance.zoomWithWheel);

  // Decode image name from URL
  const imageName = decodeURIComponent(imageUrl).split('/').pop();

  // Fetch image info from the backend
  fetch(`/api/image-info?imageName=${encodeURIComponent(imageName)}`)
    .then(response => {
      if (!response.ok) throw new Error('Image not found');
      return response.json();
    })
    .then(data => {
      modalDescription.textContent = data.context || 'No description available';
      // Remove all existing tag elements (except for the add tag button)
      Array.from(modalTags.children).forEach(child => {
        if (child.id !== 'addtagbutton') child.remove();
      });
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach(tag => {
          const tagElement = createTagElement(imageName, tag);
          modalTags.insertBefore(tagElement, modalTags.firstChild);
        });
      }
      
      // Show/hide retag button based on needsTagging flag
      retagButton.style.display = data.needsTagging ? 'flex' : 'none';
      
      modal.classList.remove('modal-hide');
    })
    .catch(error => {
      console.error('Error fetching image info:', error);
      modalDescription.textContent = 'Error fetching image information.';
      modalTags.innerHTML = '';
    });

  // Change modal background color based on the key color of the image
  const imgElement = new Image();
  imgElement.src = imageUrl;
  getKeyColor(imgElement).then(color => {
    modalContent.style.backgroundColor = color.closestMatch;
    if (isColorDarkerThanGray(color.closestMatch)) {
      modal.classList.add('dark-mode');
    } else {
      modal.classList.remove('dark-mode');
    }
  }).catch(error => {
    modalContent.style.backgroundColor = "var(--color-primary-background)";
    console.error('Error getting key color:', error);
  });

  // Listen for arrow keys to navigate the modal (a custom event will be dispatched by another module)
  window.addEventListener('keydown', handleArrowKeys);
}

function createTagElement(imageName, tag) {
  // Create a tag element with text and a remove button.
  const tagElement = document.createElement('span');
  const textSpan = document.createElement('span');
  textSpan.textContent = tag;
  textSpan.classList.add('tag-text');
  tagElement.appendChild(textSpan);
  tagElement.classList.add('tag');

  const removeDiv = document.createElement('div');
  removeDiv.innerHTML = feather.icons['x'].toSvg({ width: 16, height: 16 });
  removeDiv.classList.add('remove-tag-div');
  removeDiv.addEventListener('click', (event) => {
    event.stopPropagation();
    removeTag(imageName, tag, tagElement);
  });
  tagElement.appendChild(removeDiv);

  // Clicking a tag will search for that tag (dispatch a custom event)
  tagElement.addEventListener('click', () => {
    modal.classList.add('modal-hide');
    searchBox.value = tag;
    const searchEvent = new CustomEvent('searchTag', { detail: tag });
    window.dispatchEvent(searchEvent);
  });
  return tagElement;
}

function handleArrowKeys(event) {
  // If focus is not on the modal description or add tag button, dispatch a custom navigation event.
  if (document.activeElement !== modalDescription && document.activeElement !== addTagButton) {
    if (event.key === 'ArrowRight') {
      window.dispatchEvent(new CustomEvent('navigateModal', { detail: 'next' }));
    } else if (event.key === 'ArrowLeft') {
      window.dispatchEvent(new CustomEvent('navigateModal', { detail: 'prev' }));
    }
  }
}

function updateDescription() {
  const newDescription = modalDescription.textContent.trim();
  const imageName = decodeURIComponent(modalImage.style.backgroundImage.slice(5, -2)).split('/').pop();

  updateDescriptionAPI(imageName, newDescription)
    .then(data => console.log(data.message))
    .catch(error => console.error('Error updating description:', error));
  modalDescription.blur();
}

function addTag() {
  const newTag = addTagButton.textContent.trim();
  const imageName = decodeURIComponent(modalImage.style.backgroundImage.slice(5, -2)).split('/').pop();
  if (newTag) {
    addTagAPI(imageName, newTag)
      .then(data => {
        console.log(data.message);
        // Add the new tag to the modal UI.
        const tagElement = createTagElement(imageName, newTag);
        modalTags.insertBefore(tagElement, addTagButton);
        addTagButton.textContent = '';
      })
      .catch(error => console.error('Error adding tag:', error));
  }
}

function removeTag(imageName, tag, tagElement) {
  removeTagAPI(imageName, tag)
    .then(data => {
      console.log(data.message);
      tagElement.remove();
    })
    .catch(error => console.error('Error removing tag:', error));
}

export { setupModal, openImageModal, updateDescription, addTag, removeTag };
export { handleArrowKeys }; // (if other modules need to reference this)