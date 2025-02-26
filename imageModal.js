const { ipcRenderer } = require('electron');
const ImageService = require('./services/imageService');
const AIService = require('./services/aiService');
const SettingsService = require('./services/settingsService');
const DataService = require('./services/dataService');
const path = require('path');
const feather = require('feather-icons');

window.addEventListener('DOMContentLoaded', () => {
    if (feather) {
        feather.replace();
        console.log('Feather Icons loaded');
    }
});

// Initialize services
const personalPath = path.join(require('os').homedir(), 'Personal');
const dataService = new DataService(personalPath);
const settingsService = new SettingsService(dataService);
const aiSettings = settingsService.getAISettings() || { model: 'openai', apiKey: '', autoTag: false };
const aiService = new AIService(aiSettings.model, aiSettings.apiKey);
const imageService = new ImageService(personalPath, dataService, settingsService, null);

let currentImage = null;
let panzoomInstance = null;

// DOM Elements
const modalImage = document.getElementById('modalImage');
const imageTitle = document.getElementById('imageTitle');
const imageDescription = document.getElementById('imageDescription');
const tagContainer = document.getElementById('tagContainer');
const tagInput = document.getElementById('tagInput');
const generateTagsButton = document.getElementById('generateTags');
const closeButton = document.getElementById('closeButton');
const zoomInButton = document.getElementById('zoomIn');
const zoomOutButton = document.getElementById('zoomOut');
const zoomResetButton = document.getElementById('zoomReset');
const copyButton = document.getElementById('copyButton');
const bottomButtonsContainer = document.getElementById('bottomButtonsContainer');

// Additional DOM Elements for cropping
const cropButton = document.getElementById('cropButton');
const cropInterface = document.getElementById('cropInterface');
const cropOverlay = document.getElementById('cropOverlay');
const cropArea = document.getElementById('cropArea');
const rotateLeftButton = document.getElementById('rotateLeft');
const rotateRightButton = document.getElementById('rotateRight');
const zoomInCropButton = document.getElementById('zoomInCrop');
const zoomOutCropButton = document.getElementById('zoomOutCrop');
const cancelCropButton = document.getElementById('cancelCrop');
const applyCropButton = document.getElementById('applyCrop');

let isCropping = false;
let cropRotation = 0;
let cropScale = 1;
let isDragging = false;
let isResizing = false;
let startX = 0;
let startY = 0;
let cropStartX = 0;
let cropStartY = 0;
let activeHandle = null;

// Create toast element
const toast = document.createElement('div');
toast.className = 'toast color-scheme-reverse';
document.body.appendChild(toast);

function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}



// Initialize panzoom
function initializePanzoom() {
    if (panzoomInstance) {
        panzoomInstance.dispose();
    }

    panzoomInstance = panzoom(modalImage, {
        maxZoom: 10,
        minZoom: 0.1,
        bounds: true,
        boundsPadding: 0.1,
        smoothScroll: false,
        beforeWheel: function(e) {
            // Allow wheel-zoom only with ctrl key pressed
            return !e.ctrlKey;
        },
        beforeMouseDown: function(e) {
            // Allow mouse-down when image is zoomed or middle button is pressed
            return panzoomInstance.getTransform().scale === 1 && e.button !== 1;
        }
    });

    // Set initial transform
    panzoomInstance.zoomAbs(0, 0, 1);

    // Add zoom controls
    zoomInButton.addEventListener('click', () => {
        const { scale } = panzoomInstance.getTransform();
        panzoomInstance.smoothZoom(0, 0, scale * 1.5);
    });

    zoomOutButton.addEventListener('click', () => {
        const { scale } = panzoomInstance.getTransform();
        panzoomInstance.smoothZoom(0, 0, scale / 1.5);
    });

    zoomResetButton.addEventListener('click', () => {
        resetZoom();
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                const { scale } = panzoomInstance.getTransform();
                panzoomInstance.smoothZoom(0, 0, scale * 1.5);
            } else if (e.key === '-') {
                e.preventDefault();
                const { scale } = panzoomInstance.getTransform();
                panzoomInstance.smoothZoom(0, 0, scale / 1.5);
            } else if (e.key === '0') {
                e.preventDefault();
                resetZoom();
            }
        } else if (e.key === 'Escape') {
            window.close();
        }
    });
}

function resetZoom() {
    if (panzoomInstance) {
        panzoomInstance.smoothZoom(0, 0, 1);
        panzoomInstance.moveTo(0, 0);
    }
}

// Receive image data from main process
ipcRenderer.on('image-data', async (event, imageData) => {
    // Get fresh data from DataService
    const freshData = dataService.getImageData(imageData.name);
    currentImage = freshData || imageData; // Fallback to passed data if not found
    updateModalContent(currentImage);
});

function updateModalContent(image) {
    // Get fresh data again in case it was updated
    const freshData = dataService.getImageData(image.name);
    if (freshData) {
        image = freshData;
        currentImage = freshData;
    }
    
    modalImage.src = image.fileUrl;
    modalImage.alt = image.title || '';
    imageTitle.textContent = image.title || 'Untitled';
    imageDescription.textContent = image.description || 'No description available.';
    updateTags(image.tags || []);

    // Initialize panzoom after image is loaded
    modalImage.onload = () => {
        initializePanzoom();
    };
}

function updateTags(tags) {
    // Clear existing tags
    const existingTags = tagContainer.querySelectorAll('.m-tag');
    existingTags.forEach(tag => tag.remove());

    // Add new tags
    tags.forEach(tagText => {
        const tagElement = createTagElement(tagText);
        tagContainer.insertBefore(tagElement, tagInput);
    });

    // Update generate tags button text
    
    generateTagsButton.innerHTML = tags.length > 0 ? 
        '<i data-feather="zap"></i> Retag with AI' : 
        '<i data-feather="zap"></i> Generate Tags with AI';
    feather.replace(); // Refresh Feather icons
}

function createTagElement(tagText) {
    const tagElement = document.createElement('span');
    tagElement.className = 'm-tag';
    tagElement.innerHTML = `${tagText}<span class="tag-delete">&times;</span>`;
    return tagElement;
}

// Event Listeners
imageTitle.addEventListener('blur', async () => {
    if (!currentImage) return;
    
    const oldTitle = currentImage.title;
    const newTitle = imageTitle.textContent;
    
    // Only update if the title has changed
    if (oldTitle !== newTitle) {
        currentImage.title = newTitle;
        console.log('Title edited:', {
            oldTitle,
            newTitle,
            imageName: currentImage.name
        });
        await dataService.updateImageTitle(currentImage.name, newTitle);
        // Notify main window of the update
        ipcRenderer.send('image-updated', currentImage);
    }
});

imageDescription.addEventListener('blur', async () => {
    if (!currentImage) return;

    const oldDescription = currentImage.description;
    const newDescription = imageDescription.textContent;
    
    // Only update if the description has changed
    if (oldDescription !== newDescription) {
        currentImage.description = newDescription;
        console.log('Description edited:', {
            oldDescription,
            newDescription,
            imageName: currentImage.name
        });
        await dataService.updateImageDescription(currentImage.name, newDescription);
        // Notify main window of the update
        ipcRenderer.send('image-updated', currentImage);
    }
});

tagContainer.addEventListener('click', async (e) => {
    if (!currentImage) return;

    if (e.target.classList.contains('tag-delete')) {
        const tag = e.target.parentElement;
        const tagText = tag.textContent.slice(0, -1); // Remove the × symbol
        currentImage.tags = currentImage.tags.filter(t => t !== tagText);
        console.log('Tag deleted:', {
            removedTag: tagText,
            remainingTags: currentImage.tags,
            imageName: currentImage.name
        });
        tag.remove();
        await dataService.updateImageTags(currentImage.name, currentImage.tags);
        // Notify main window of the update
        ipcRenderer.send('image-updated', currentImage);
    }
});

tagInput.addEventListener('keypress', async (e) => {
    if (!currentImage) return;

    if (e.key === 'Enter' && tagInput.value.trim()) {
        const newTag = tagInput.value.trim();
        if (!currentImage.tags) {
            currentImage.tags = [];
        }
        if (!currentImage.tags.includes(newTag)) {
            currentImage.tags.push(newTag);
            console.log('Tag added:', {
                newTag,
                allTags: currentImage.tags,
                imageName: currentImage.name
            });
            const tagElement = createTagElement(newTag);
            tagContainer.insertBefore(tagElement, tagInput);
            await dataService.updateImageTags(currentImage.name, currentImage.tags);
            // Notify main window of the update
            ipcRenderer.send('image-updated', currentImage);
        }
        tagInput.value = '';
    }
});

generateTagsButton.addEventListener('click', async () => {
    if (!currentImage) return;

    try {
        // Add loading state
        document.body.classList.add('loading-tags');
        generateTagsButton.classList.add('ai-button--loading');
        generateTagsButton.innerHTML = `
            <i data-feather="loader"></i>
            <span>Generating...</span>
        `;
        feather.replace(); // Render the icon

        const imageData = await imageService.getImageBase64(currentImage.filePath);
        const result = await aiService.generateImageDescription(imageData);

        // Update image data with AI results
        if (result.title) {
            currentImage.title = result.title;
            await dataService.updateImageTitle(currentImage.name, result.title);
        }
        if (result.description) {
            currentImage.description = result.description;
            await dataService.updateImageDescription(currentImage.name, result.description);
        }
        if (result.tags && result.tags.length > 0) {
            currentImage.tags = result.tags;
            await dataService.updateImageTags(currentImage.name, result.tags);
        }

        // Notify main window of the update
        ipcRenderer.send('image-updated', currentImage);

        // Update UI
        updateModalContent(currentImage);
    } catch (error) {
        console.error('Error generating tags:', error);
        alert('Error generating tags. Please check your API key and try again.');
    } finally {
        // Remove loading state
        document.body.classList.remove('loading-tags');
        generateTagsButton.classList.remove('ai-button--loading');

        generateTagsButton.innerHTML = tags?.length > 0 ? 
        '<i data-feather="zap"></i> Retag with AI' : 
        '<i data-feather="zap"></i> Generate Tags with AI';
    feather.replace(); // Refresh Feather icons

    }
});

closeButton.addEventListener('click', () => {
    window.close();
});

// Clean up panzoom when window is closed
window.addEventListener('beforeunload', () => {
    if (panzoomInstance) {
        panzoomInstance.dispose();
    }
});

// Initialize crop functionality
function initializeCrop() {
    const imageRect = modalImage.getBoundingClientRect();
    const initialSize = Math.min(imageRect.width, imageRect.height) * 0.8;
    
    cropArea.style.width = `${initialSize}px`;
    cropArea.style.height = `${initialSize}px`;
    cropArea.style.left = `${(imageRect.width - initialSize) / 2}px`;
    cropArea.style.top = `${(imageRect.height - initialSize) / 2}px`;
}

// Crop mode handlers
cropButton.addEventListener('click', () => {
    isCropping = true;
    cropInterface.classList.add('active');
    cropOverlay.classList.add('active');
    bottomButtonsContainer.classList.add('hidden'); // Show crop button again
    initializeCrop();
    
    // Disable panzoom while cropping
    if (panzoomInstance) {
        panzoomInstance.dispose();
    }
});

cancelCropButton.addEventListener('click', () => {
    isCropping = false;
    cropInterface.classList.remove('active');
    cropOverlay.classList.remove('active');
    bottomButtonsContainer.classList.remove('hidden'); // Show crop button again
    cropRotation = 0;
    cropScale = 1;
    modalImage.style.transform = '';
    initializePanzoom();
});

// Rotation handlers
rotateLeftButton.addEventListener('click', () => {
    cropRotation = (cropRotation - 90) % 360;
    modalImage.style.transform = `rotate(${cropRotation}deg) scale(${cropScale})`;
});

rotateRightButton.addEventListener('click', () => {
    cropRotation = (cropRotation + 90) % 360;
    modalImage.style.transform = `rotate(${cropRotation}deg) scale(${cropScale})`;
});

// Zoom handlers
zoomInCropButton.addEventListener('click', () => {
    cropScale = Math.min(cropScale * 1.2, 3);
    modalImage.style.transform = `rotate(${cropRotation}deg) scale(${cropScale})`;
});

zoomOutCropButton.addEventListener('click', () => {
    cropScale = Math.max(cropScale / 1.2, 0.5);
    modalImage.style.transform = `rotate(${cropRotation}deg) scale(${cropScale})`;
});

// Crop area drag handlers
cropArea.addEventListener('mousedown', (e) => {
    if (e.target === cropArea) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        cropStartX = cropArea.offsetLeft;
        cropStartY = cropArea.offsetTop;
    }
});

// Resize handlers
cropArea.querySelectorAll('.crop-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        activeHandle = e.target;
        startX = e.clientX;
        startY = e.clientY;
        e.stopPropagation();
    });
});

document.addEventListener('mousemove', (e) => {
    if (!isCropping) return;
    
    if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        cropArea.style.left = `${cropStartX + dx}px`;
        cropArea.style.top = `${cropStartY + dy}px`;

    } else if (isResizing && activeHandle) {
        const rect = cropArea.getBoundingClientRect();
        const isLeft = activeHandle.style.left === '-5px';
        const isTop = activeHandle.style.top === '-5px';
        const isRight = !isLeft;
        const isBottom = !isTop;

        console.log('Resize Debug:', {
            activeHandle: activeHandle.className,
            isLeft,
            isRight,
            isTop,
            isBottom,
            mouseX: e.clientX,
            mouseY: e.clientY,
            startX,
            startY,
            rectLeft: rect.left,
            rectTop: rect.top,
            rectWidth: rect.width,
            rectHeight: rect.height
        });
    
        if (isRight || isLeft) {
            const dx = isRight ? e.clientX - startX : startX - e.clientX;

            const newWidth = isRight ? 
                rect.width + dx : 
                rect.width + dx;
            
            if (newWidth > 50) {
                cropArea.style.width = `${newWidth}px`;
                if (isLeft) {
                    cropArea.style.left = `${startX}px`;
                }
            
                startX = e.clientX;
            }
        }
       
        if (isTop || isBottom) {
            // Use the same pattern as the horizontal logic
            const dy = isBottom ? (e.clientY - startY) : (startY - e.clientY);
            
            // Calculate new height
            const newHeight = isBottom
                ? rect.height + dy
                : rect.height + dy;
            
            // Guard for minimum size
            if (newHeight > 50) {
                cropArea.style.height = `${newHeight}px`;
                
                // If resizing from the top, shift the element's `top` too
                if (isTop) {
                    cropArea.style.top = `${startY}px`;
                }
       
                startY = e.clientY;
            }
        }
    }
});


document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    activeHandle = null;
});

// Apply crop
applyCropButton.addEventListener('click', async () => {
    if (!currentImage) return;
    
    try {
        applyCropButton.disabled = true;
        applyCropButton.textContent = 'Applying...';
        
        const imageRect = modalImage.getBoundingClientRect();
        const cropRect = cropArea.getBoundingClientRect();
        const modalRect = document.querySelector('.modal-image').getBoundingClientRect();
        
        // Get the natural dimensions of the image
        const naturalWidth = modalImage.naturalWidth;
        const naturalHeight = modalImage.naturalHeight;
        
        // Calculate the displayed image dimensions accounting for rotation
        let displayedWidth = imageRect.width;
        let displayedHeight = imageRect.height;
        
        if (cropRotation === 90 || cropRotation === 270) {
            // Swap dimensions for rotated image
            [displayedWidth, displayedHeight] = [displayedHeight, displayedWidth];
        }
        
        // Calculate the scale factors between natural and displayed image
        const scaleX = naturalWidth / displayedWidth;
        const scaleY = naturalHeight / displayedHeight;
        
        // Calculate the image's position relative to its container
        const imageLeft = imageRect.left - modalRect.left;
        const imageTop = imageRect.top - modalRect.top;
        
        // Calculate crop area position relative to the image
        const relativeLeft = cropRect.left - modalRect.left - imageLeft;
        const relativeTop = cropRect.top - modalRect.top - imageTop;
        
        // Calculate the crop coordinates in terms of the natural image size
        const cropData = {
            x: Math.max(0, Math.round(relativeLeft * scaleX)),
            y: Math.max(0, Math.round(relativeTop * scaleY)),
            width: Math.min(naturalWidth, Math.round(cropRect.width * scaleX)),
            height: Math.min(naturalHeight, Math.round(cropRect.height * scaleY)),
            rotation: cropRotation
        };
        
        await imageService.cropImage(currentImage.filePath, cropData);
        
        // Reset crop mode
        isCropping = false;
        cropInterface.classList.remove('active');
        cropOverlay.classList.remove('active');
        bottomButtonsContainer.classList.remove('hidden'); // Show crop button again
        cropRotation = 0;
        cropScale = 1;
        modalImage.style.transform = '';
        
        // Reload image in modal
        modalImage.src = `${currentImage.fileUrl}?t=${Date.now()}`;
        initializePanzoom();

    
        
    } catch (error) {
        console.error('Error applying crop:', error);
        alert('Error applying crop. Please try again.');
    } finally {
        applyCropButton.disabled = false;
        applyCropButton.textContent = 'Apply';
    }
});

// Copy button functionality
copyButton.addEventListener('click', async () => {
    if (!currentImage) return;
    
    try {
        // Create a temporary canvas to convert the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Wait for the image to load
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                resolve();
            };
            img.onerror = reject;
            img.src = currentImage.fileUrl;
        });
        
        // Convert to PNG blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
        
        // Create a ClipboardItem with PNG format
        const item = new ClipboardItem({
            'image/png': blob
        });
        
        // Write to clipboard
        await navigator.clipboard.write([item]);
        
        // Show success message
        showToast('Image copied to clipboard');
    } catch (error) {
        console.error('Failed to copy image:', error);
        showToast('Failed to copy image');
    }
}); 