class DOMManager {
    constructor(imageGrid, searchService) {
        this.imageGrid = imageGrid;
        this.searchService = searchService;
        this.allImages = [];
        this.visibleImages = [];
        this.isLoadingMore = false;
        this.currentColumn = 0;
        this.columnCount = parseInt(document.getElementById('columnSlider')?.value || 3);

        // Create loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'loading-indicator';
        this.loadingIndicator.innerHTML = '<div class="spinner"></div><div>Loading images...</div>';
        this.loadingIndicator.style.display = 'none';
        document.body.appendChild(this.loadingIndicator);

        // Add the main grid class and create columns
        this.imageGrid.classList.add('image-grid');
        this.createColumns();

        // Listen for column count changes
        document.getElementById('columnSlider')?.addEventListener('input', (e) => {
            this.columnCount = parseInt(e.target.value);
            this.createColumns();
            this.displayImages(true);
        });
    }

    createColumns() {
        // Clear existing columns
        this.imageGrid.innerHTML = '';
        
        // Create columns based on current column count
        for (let i = 0; i < this.columnCount; i++) {
            const column = document.createElement('div');
            column.className = 'grid-column';
            this.imageGrid.appendChild(column);
        }
        this.currentColumn = 0;
    }

    getNextColumn() {
        const columns = this.imageGrid.querySelectorAll('.grid-column');
        const column = columns[this.currentColumn];
        this.currentColumn = (this.currentColumn + 1) % this.columnCount;
        return column;
    }

    setImages(images) {
        this.allImages = images;
        this.updateVisibleImages();
    }

    updateVisibleImages(searchQuery = '', searchType = '') {
        this.visibleImages = this.searchService.filterImages(
            this.allImages,
            searchQuery,
            searchType
        );
        this.displayImages(true);
    }

    async displayImages(resetGrid = false) {
        try {
            const pagesToShow = this.searchService.getPageImages(this.visibleImages);
            
            if (resetGrid) {
                this.imageGrid.innerHTML = '';
                this.createColumns();
                this.searchService.resetPagination();
            }

            pagesToShow.forEach(image => {
                const gridItem = this.createImageGridItem(image);
                const column = this.getNextColumn();
                column.appendChild(gridItem);
            });

            if (this.visibleImages.length === 0) {
                this.showNoResults();
            } else {
                this.hideNoResults();
            }
        } catch (error) {
            console.error('Error displaying images:', error);
        }
    }

    createImageGridItem(image) {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        
        gridItem.dataset.imageName = image.name;

        const img = document.createElement('img');
        img.src = image.fileUrl;
        img.loading = 'lazy';
        img.alt = image.title || '';

        gridItem.appendChild(img);

        // Add click handler if needed
        if (this.onImageClick) {
            gridItem.addEventListener('click', () => this.onImageClick(image));
        }

        return gridItem;
    }

    showNoResults() {
        document.getElementsByClassName('no-results')[0].classList.add('visible');
    }

    hideNoResults() {
        document.getElementsByClassName('no-results')[0].classList.remove('visible');
    }

    handleImageAdded(imageData) {
        // Add to master list at the beginning
        this.allImages.unshift(imageData);
        
        // Check if it should be visible with current search
        const shouldBeVisible = this.searchService.imageMatchesSearch(
            imageData,
            this.searchService.currentQuery,
            this.searchService.currentSearchType
        );

        if (shouldBeVisible) {
            this.visibleImages.unshift(imageData);
            const gridItem = this.createImageGridItem(imageData);
            const column = this.getNextColumn();
            column.insertBefore(gridItem, column.firstChild);
        }
    }

    handleImageDeleted(fileName) {
        console.log(`🗑️ Deleting image: ${fileName}`);
        // Remove from master list
        this.allImages = this.allImages.filter(img => img.name !== fileName);
        
        // Remove from visible images if present
        const wasVisible = this.visibleImages.some(img => img.name === fileName);
        if (wasVisible) {
            this.visibleImages = this.visibleImages.filter(img => img.name !== fileName);
            
            // Remove from DOM
            const gridItem = this.imageGrid.querySelector(`[data-image-name="${fileName}"]`);
            if (gridItem) {
                gridItem.remove();
            }
        }
    }

    handleImageUpdated(imageData) {
        // Update in master list
        const masterIndex = this.allImages.findIndex(img => img.name === imageData.name);
        if (masterIndex !== -1) {
            this.allImages[masterIndex] = { ...this.allImages[masterIndex], ...imageData };
        }

        // Update in visible list and DOM if present
        const visibleIndex = this.visibleImages.findIndex(img => img.name === imageData.name);
        if (visibleIndex !== -1) {
            this.visibleImages[visibleIndex] = { ...this.visibleImages[visibleIndex], ...imageData };
            
            // Update DOM
            const gridItem = this.imageGrid.querySelector(`[data-image-name="${imageData.name}"]`);
            if (gridItem) {
                // Create new grid item with updated data and force image reload with timestamp
                const newGridItem = this.createImageGridItem({
                    ...this.visibleImages[visibleIndex],
                    fileUrl: `${this.visibleImages[visibleIndex].fileUrl}?t=${Date.now()}`
                });
                gridItem.replaceWith(newGridItem);
            }
        }
    }

    handleStoreCleared() {
        this.allImages = [];
        this.visibleImages = [];
        this.imageGrid.innerHTML = '';
        this.currentColumn = 0;
    }

    setImageClickHandler(handler) {
        this.onImageClick = handler;
    }

    hasNextPage() {
        return this.searchService.hasNextPage(this.visibleImages.length);
    }

    nextPage() {
        this.searchService.nextPage();
    }

    showLoadingIndicator() {
        this.loadingIndicator.style.display = 'flex';
    }

    hideLoadingIndicator() {
        this.loadingIndicator.style.display = 'none';
    }

    handleImageProcessed(processedData) {
        // Find and update the image in our lists
        const masterIndex = this.allImages.findIndex(img => img.name === processedData.name);
        if (masterIndex !== -1) {
            this.allImages[masterIndex] = { ...this.allImages[masterIndex], ...processedData };
        }

        const visibleIndex = this.visibleImages.findIndex(img => img.name === processedData.name);
        if (visibleIndex !== -1) {
            this.visibleImages[visibleIndex] = { ...this.visibleImages[visibleIndex], ...processedData };
            
            // Update the grid item if it exists
            const gridItem = this.imageGrid.querySelector(`[data-image-name="${processedData.name}"]`);
            if (gridItem) {
                const newGridItem = this.createImageGridItem(this.visibleImages[visibleIndex]);
                gridItem.replaceWith(newGridItem);
            }
        }
    }
}

module.exports = DOMManager; 