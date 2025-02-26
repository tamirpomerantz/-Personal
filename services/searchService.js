/**
 * SearchService - Handles image searching and pagination
 * 
 * Interface:
 * - Exports: SearchService class
 * - Dependencies: None (works with data provided by ImageService)
 * 
 * Public Methods:
 * - setSearchQuery(query, searchType): Set current search parameters
 * - filterImages(images, query, searchType): Filter images based on search criteria
 * - getPageImages(images): Get current page of images
 * - hasNextPage(totalImages): Check if next page exists
 * - hasPreviousPage(): Check if previous page exists
 * - nextPage(): Move to next page
 * - previousPage(): Move to previous page
 * - resetPagination(): Reset to first page
 * - shuffleImages(images): Randomly shuffle images
 * 
 * Search Types:
 * - 'all': Search across all fields
 * - 'ocr': Search only OCR text
 * - 'tags': Search only tags
 * - 'title': Search only titles
 * 
 * Interacts with:
 * - ImageService: Receives image data for searching
 * - DOMManager: Provides pagination info for UI updates
 */

class SearchService {
    constructor(imagesPerPage = 12) {
        this.currentPage = 0;
        this.imagesPerPage = imagesPerPage;
        this.currentQuery = '';
        this.currentSearchType = 'all'; // 'all', 'ocr', 'tags', 'title'
    }

    setSearchQuery(query, searchType = 'all') {
        this.currentQuery = query;
        this.currentSearchType = searchType;
        this.resetPagination();
    }

    filterImages(images, query, searchType = 'all') {
        if (!query) {
            return images;
        }

        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        
        return images.filter(image => this.imageMatchesSearch(image, searchTerms, searchType));
    }

    imageMatchesSearch(image, searchTerms, searchType = 'all') {
        if (!searchTerms || (Array.isArray(searchTerms) && searchTerms.length === 0)) {
            return true;
        }

        // If searchTerms is a string (from direct search), convert it to array
        if (typeof searchTerms === 'string') {
            searchTerms = searchTerms.toLowerCase().split(' ').filter(term => term.length > 0);
        }

        switch (searchType) {
            case 'ocr':
                return this.matchesOCR(image, searchTerms);
            case 'tags':
                return this.matchesTags(image, searchTerms);
            case 'title':
                return this.matchesTitle(image, searchTerms);
            case 'all':
            default:
                return this.matchesAny(image, searchTerms);
        }
    }

    matchesOCR(image, searchTerms) {
        const text = (image.ocrText || '').toLowerCase();
        return searchTerms.every(term => text.includes(term));
    }

    matchesTags(image, searchTerms) {
        const tags = (image.tags || []).map(tag => tag.toLowerCase());
        return searchTerms.every(term => 
            tags.some(tag => tag.includes(term))
        );
    }

    matchesTitle(image, searchTerms) {
        const title = (image.title || '').toLowerCase();
        return searchTerms.every(term => title.includes(term));
    }

    matchesAny(image, searchTerms) {
        const text = [
            image.ocrText || '',
            image.title || '',
            image.description || '',
            ...(image.tags || [])
        ].join(' ').toLowerCase();

        return searchTerms.every(term => text.includes(term));
    }

    getPageImages(images) {
        console.log('Getting page images:', {
            currentPage: this.currentPage,
            imagesPerPage: this.imagesPerPage,
            totalImages: images.length
        });
        const start = this.currentPage * this.imagesPerPage;
        const end = start + this.imagesPerPage;
        const pageImages = images.slice(start, end);
        console.log('Returning images:', {
            start,
            end,
            pageSize: pageImages.length
        });
        return pageImages;
    }

    hasNextPage(totalImages) {
        const hasNext = (this.currentPage + 1) * this.imagesPerPage < totalImages;
        console.log('Checking next page:', {
            currentPage: this.currentPage,
            totalImages,
            hasNext
        });
        return hasNext;
    }

    hasPreviousPage() {
        return this.currentPage > 0;
    }

    nextPage() {
        console.log('Moving to next page:', this.currentPage + 1);
        this.currentPage++;
    }

    previousPage() {
        if (this.hasPreviousPage()) {
            this.currentPage--;
        }
    }

    resetPagination() {
        console.log('Resetting pagination');
        this.currentPage = 0;
    }

    shuffleImages(images) {
        const shuffled = [...images];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

module.exports = SearchService; 