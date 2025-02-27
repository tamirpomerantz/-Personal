const { ipcRenderer } = require('electron');
const feather = require('feather-icons');
const ImageService = require('./services/imageService');
const SearchService = require('./services/searchService');
const AIService = require('./services/aiService');
const SettingsService = require('./services/settingsService');
const DataService = require('./services/dataService');
const DOMManager = require('./services/domManager');
const path = require('path');
const fs = require('fs');

// Initialize services
const personalPath = path.join(require('os').homedir(), 'Personal');

// Ensure directory exists
if (!fs.existsSync(personalPath)) {
    fs.mkdirSync(personalPath, { recursive: true });
}

// Initialize services in correct order
const dataService = new DataService(personalPath);
const settingsService = new SettingsService(dataService);

// Get settings before initializing other services
const settings = settingsService.getAISettings();
const searchSettings = settingsService.getSearchSettings();

// Initialize dependent services
const aiService = new AIService(settings.model, settings.apiKey);

// Create image change handler
const handleImageChange = (type, imageData) => {
    switch (type) {
        case 'add':
            domManager?.handleImageAdded?.(imageData);
            break;
        case 'remove':
            domManager?.handleImageDeleted?.(imageData.name);
            break;
        case 'update':
            domManager?.handleImageUpdated?.(imageData);
            break;
    }
};

// Reinitialize DataService with image change handler
dataService.onImageChange = handleImageChange;

const imageService = new ImageService(personalPath, dataService, settingsService, aiService);
const searchService = new SearchService(searchSettings.imagesPerPage);

// DOM Elements
const imageGrid = document.getElementById('imageGrid');
const searchInput = document.getElementById('searchInput');
const searchTypeSelect = document.getElementById('searchType');
const shuffleButton = document.getElementById('shuffleButton');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const autoTagCheckbox = document.getElementById('autoTagCheckbox');
const mainPromptInput = document.getElementById('mainPromptInput');
const saveSettingsButton = document.getElementById('saveSettings');
const closeSettingsButton = document.getElementById('closeSettings');
const clearStoreButton = document.getElementById('clearStore');
const columnSlider = document.getElementById('columnSlider');
const darkModeToggle = document.getElementById('darkModeToggle');
const searchHint = document.getElementById('searchHint');
searchHint.classList.add('hidden');


// Add ESC key handler to clear input or close window
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        
        if (document.activeElement === searchInput) {
            searchInput.innerText = ''; // Clear the input
            searchInput.blur(); // Unfocus the input field
            searchHint.classList.add('hidden');
            searchService.setSearchQuery("", searchTypeSelect.value);
            domManager.updateVisibleImages("", searchTypeSelect.value);
        } else {
            ipcRenderer.send('close-window');
        }
    }
});
  
// Initialize DOM Manager
const domManager = new DOMManager(imageGrid, searchService);

// Set up image click handler
domManager.setImageClickHandler(showImageModal);

// Initialize the application
async function initializeApp() {
    // Initialize Feather Icons
    feather.replace();

    // Load settings
    loadSettings();

    // Set focus on search input
    searchInput.focus();

    // Set up scroll handler for infinite scrolling
    setupInfiniteScroll();

    // Load images
    await loadImages();

    // Set up ImageService event listeners
    imageService.on('image-added', (imageData) => {
        domManager.handleImageAdded(imageData);
    });

    imageService.on('image-deleted', (fileName) => {
        domManager.handleImageDeleted(fileName);
    });

    imageService.on('image-updated', (imageData) => {
        domManager.handleImageUpdated(imageData);
    });

    imageService.on('store-cleared', () => {
        domManager.handleStoreCleared();
    });

    // Add handler for processed images
    imageService.on('image-processed', (processedData) => {
        domManager.handleImageProcessed(processedData);
    });

    // Listen for updates from modal window
    ipcRenderer.on('image-updated', (event, updatedImage) => {
        // Update in DataService using individual methods
        if (updatedImage.title !== undefined) {
            dataService.updateImageTitle(updatedImage.name, updatedImage.title);
        }
        if (updatedImage.description !== undefined) {
            dataService.updateImageDescription(updatedImage.name, updatedImage.description);
        }
        if (updatedImage.tags !== undefined) {
            dataService.updateImageTags(updatedImage.name, updatedImage.tags);
        }
        // Update in ImageService and trigger UI update
        imageService.emit('image-updated', updatedImage);
        // Update search results if needed
        const currentQuery = searchService.currentQuery;
        if (currentQuery) {
            domManager.updateVisibleImages(currentQuery, searchService.currentSearchType);
        }
    });

}

// Image loading and display
async function loadImages() {
    try {
        // Show loading indicator
        domManager.showLoadingIndicator();
        
        const images = await imageService.loadImages();
        domManager.setImages(images);
        
        // Hide loading indicator once initial images are displayed
        domManager.hideLoadingIndicator();
    } catch (error) {
        console.error('Error loading images:', error);
        domManager.hideLoadingIndicator();
    }
}

// Infinite scrolling
let isLoadingMore = false;

function setupInfiniteScroll() {
    // Remove any existing scroll listener
    window.removeEventListener('scroll', handleScroll);
    // Add scroll listener
    window.addEventListener('scroll', handleScroll);
}

function handleScroll() {
    if (isLoadingMore) return;

    const scrollPosition = window.innerHeight + window.scrollY;
    const scrollThreshold = document.documentElement.scrollHeight - 200; // Load more when within 200px of bottom

    if (scrollPosition >= scrollThreshold) {
        loadMoreImages();
    }
}

async function loadMoreImages() {
    if (isLoadingMore || !searchService.hasNextPage(domManager.visibleImages.length)) {
        return;
    }

    try {
        isLoadingMore = true;
        searchService.nextPage();
        await domManager.displayImages(false);
    } catch (error) {
        console.error('Error loading more images:', error);
    } finally {
        isLoadingMore = false;
    }
}

// Image modal
async function showImageModal(image) {
    try {
        // Get fresh data before opening modal
        const freshData = dataService.getImageData(image.name);
        await ipcRenderer.invoke('open-image-modal', freshData || image);
    } catch (error) {
        console.error('Error opening image modal:', error);
    }
}

// AI Integration
window.generateImageTags = async function(image) {
    try {
        const imageData = await imageService.getImageBase64(image.filePath);
        const result = await aiService.generateImageDescription(imageData);

        // Update image data with AI results
        if (result.title) {
            image.title = result.title;
            await dataService.updateImageTitle(image.name, result.title);
        }
        if (result.description) {
            image.description = result.description;
            await dataService.updateImageDescription(image.name, result.description);
        }
        if (result.tags && result.tags.length > 0) {
            image.tags = result.tags;
            await dataService.updateImageTags(image.name, result.tags);
        }

        return image;
    } catch (error) {
        console.error('Error generating tags:', error);
        throw error;
    }
}

// Settings Modal
function showSettings() {
    settingsModal.style.display = 'block';
}

function closeSettings() {
    settingsModal.style.display = 'none';
}

// Load settings
function loadSettings() {
    const aiSettings = settingsService.getAISettings() || { model: 'openai', apiKey: '', autoTag: false, mainPrompt: '' };

    if (modelSelect && apiKeyInput && autoTagCheckbox && mainPromptInput) {
        modelSelect.value = aiSettings.model || 'openai';
        apiKeyInput.value = aiSettings.apiKey || '';
        autoTagCheckbox.checked = aiSettings.autoTag || false;
        mainPromptInput.value = aiSettings.mainPrompt || '';
    }

    // if (darkModeToggle) {
    //     darkModeToggle.checked = themeSettings.isDarkMode;
    // }
}

// Save settings
function saveSettings() {
    if (modelSelect && apiKeyInput && autoTagCheckbox && mainPromptInput) {
        const settings = {
            model: modelSelect.value || 'openai',
            apiKey: apiKeyInput.value || '',
            autoTag: autoTagCheckbox.checked || false,
            mainPrompt: mainPromptInput.value || ''
        };
        // const themeSettings = {
        //     isDarkMode: darkModeToggle.checked
        // };
        // settingsService.setThemeSettings(themeSettings);
        settingsService.setAISettings(settings);
        aiService.setModel(settings.model, settings.apiKey);
        aiService.setMainPrompt(settings.mainPrompt);
        // ipcRenderer.send('update-theme', themeSettings.isDarkMode);
        closeSettings();
    }
}

// Event Listeners
searchInput.addEventListener('input', () => {
    searchService.setSearchQuery(searchInput.innerText, searchTypeSelect.value);
    domManager.updateVisibleImages(searchInput.innerText, searchTypeSelect.value);
    if (searchInput.innerText.length > 0) {
        searchHint.classList.remove('hidden');
    } else {
        searchHint.classList.add('hidden');
    }
});

searchTypeSelect.addEventListener('change', () => {
    searchService.setSearchQuery(searchInput.innerText, searchTypeSelect.value);
    domManager.updateVisibleImages(searchInput.innerText, searchTypeSelect.value);
});

shuffleButton.addEventListener('click', () => {
    const newMode = searchService.cycleSortMode();
    
    // Update button icon and tooltip based on mode
    switch (newMode) {
        case 'firstToLast':
            shuffleButton.innerHTML = feather.icons['arrow-down'].toSvg();
            shuffleButton.title = 'First to Last';
            break;
        case 'lastToFirst':
            shuffleButton.innerHTML = feather.icons['arrow-up'].toSvg();
            shuffleButton.title = 'Last to First';
            break;
        case 'normal':
            shuffleButton.innerHTML = feather.icons['shuffle'].toSvg();
            shuffleButton.title = 'Shuffle';
            break;
    }

    const sortedImages = searchService.shuffleImages(domManager.allImages);
    domManager.visibleImages = sortedImages;
    domManager.displayImages(true);
});

settingsButton.addEventListener('click', showSettings);
closeSettingsButton.addEventListener('click', closeSettings);
saveSettingsButton.addEventListener('click', saveSettings);

// Clear store event handler
clearStoreButton.addEventListener('click', async () => {
    const confirmClear = confirm('Are you sure you want to clear all OCR and image data? This action cannot be undone.');
    if (confirmClear) {
        imageService.clearStore();
        // Reload images to reflect the cleared data
        domManager.handleStoreCleared();
    }
});

// Clean up on window unload
window.addEventListener('unload', () => {
    imageService.dispose();
});

// Column slider functionality
columnSlider.addEventListener('input', (e) => {
    const columns = parseInt(e.target.value);
});

// Initialize the application
initializeApp(); 