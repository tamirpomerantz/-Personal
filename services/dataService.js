
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class DataService {
    constructor(imageDirectory, onImageChange = () => {}, processImagesWithAI = false) {
        this.imageDirectory = imageDirectory;
        this.dataFile = path.join(imageDirectory, 'imageData.json');
        this.settingsFile = path.join(imageDirectory, 'settings.json');
        this.onImageChange = onImageChange;
        this.processImagesWithAI = processImagesWithAI;
        this.imageData = new Map();
        this.settings = null;
        console.log(`🚀 DataService initialized with directory: ${imageDirectory}`);
        this.initialize();
    }

    async initialize() {
        this.loadImageData();
        this.loadSettings();
        this.setupWatcher();
        
    
    }


    loadSettings() {
        try {
            if (fs.existsSync(this.settingsFile)) {
                const data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
                this.settings = data;
                console.log('⚙️ Settings loaded successfully');
            } else {
                this.settings = {
                    ai: {
                        model: 'openai',
                        apiKey: '',
                        autoTag: false
                    },
                    images: {
                        personalPath: this.imageDirectory,
                        sortBy: 'dateAdded',
                        sortDirection: 'desc',
                        thumbnailSize: 'medium'
                    },
                    search: {
                        imagesPerPage: 12,
                        defaultSearchType: 'all'
                    }
                };
                this.saveSettings();
                console.log('⚙️ Default settings created and saved');
            }
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            this.settings = null;
        }
    }

    saveSettings() {
        try {
            fs.writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2));
            console.log('💾 Settings saved successfully');
        } catch (error) {
            console.error('❌ Error saving settings:', error);
        }
    }

    getSettings() {
        return this.settings;
    }

    updateSettings(newSettings) {
        console.log('⚙️ Updating settings:', newSettings);
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            try {
                fs.writeFileSync(this.dataFile, JSON.stringify({}, null, 2));
                console.log('📁 Created new imageData.json file');
            } catch (error) {
                console.error('❌ Error creating imageData.json:', error);
            }
        }
    }

    loadImageData() {
        try {
            this.ensureDataFile();
            const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
            this.imageData = new Map(Object.entries(data));
            console.log(`📚 Loaded data for ${this.imageData.size} images`);
        } catch (error) {
            console.error('❌ Error loading image data:', error);
            this.imageData = new Map();
        }
    }

    setupWatcher() {
        const watcher = chokidar.watch(this.imageDirectory, {
            ignored: [
                /(^|[\/\\])\../,           // ignore hidden files
                'imageData.json',          // ignore data file
                'settings.json',           // ignore settings file
                /^tmp_.*$/,               // ignore files starting with tmp_
            ],
            persistent: true,
            ignoreInitial: true  // Don't trigger 'add' events for existing files
        });

        console.log(`👀 Setting up file watcher for ${this.imageDirectory}`);
        watcher
            .on('add', path => this.handleImageAdded(path))
            .on('unlink', path => this.handleImageRemoved(path))
            .on('change', path => this.handleImageUpdated(path));
    }

    createBaseImageData(imageId, imagePath) {
        return {
            name: imageId,
            filePath: imagePath,
            fileUrl: `file://${encodeURI(imagePath)}`,
            date: new Date(),
            tags: [],
            ocrText: '',
            title: '',
            description: '',
            aiProcessed: false,
            processed: false
        };
    }

    handleImageAdded(imagePath) {
        const imageId = path.basename(imagePath);
        console.log(`🔍 Checking image: ${imageId}`);
        
        if (!this.imageData.has(imageId)) {
            console.log(`📸 New image detected: ${imageId}`);
            const newImageData = this.createBaseImageData(imageId, imagePath);
            this.imageData.set(imageId, newImageData);
            this.saveImageData();
            this.onImageChange('add', newImageData);
            //TODO: process image with ai
       
        } else {
            console.log(`ℹ️ Image ${imageId} already exists in database, skipping initialization`);
        }
    }

    handleImageRemoved(imagePath) {
        const imageId = path.basename(imagePath);
        if (this.imageData.has(imageId)) {
            console.log(`🗑️ Image removed: ${imageId}`);
            const imageData = this.imageData.get(imageId);
            this.imageData.delete(imageId);
            this.saveImageData();
            this.onImageChange('remove', imageData);
        }
    }

    handleImageUpdated(imagePath) {
        const imageId = path.basename(imagePath);
        if (this.imageData.has(imageId)) {
            console.log(`📝 Image updated: ${imageId}`);
            const imageData = this.imageData.get(imageId);
            this.onImageChange('update', imageData);
        }
    }

    // Specific update methods for image data
    updateImageTitle(imageId, title) {
        console.log(`📝 Updating title for image: ${imageId}`);
        if (this.imageData.has(imageId)) {
            const currentData = this.imageData.get(imageId);
            const updatedData = {
                ...currentData,
                title,
                aiProcessed: true
            };
            this.imageData.set(imageId, updatedData);
            this.saveImageData(imageId);
            this.onImageChange('update', updatedData);
            return true;
        }
        return false;
    }

    updateImageDescription(imageId, description) {
        console.log(`📝 Updating description for image: ${imageId}`);
        if (this.imageData.has(imageId)) {
            const currentData = this.imageData.get(imageId);
            const updatedData = {
                ...currentData,
                description,
                aiProcessed: true
            };
            this.imageData.set(imageId, updatedData);
            this.saveImageData(imageId);
            this.onImageChange('update', updatedData);
            return true;
        }
        return false;
    }

    updateImageTags(imageId, tags) {
        console.log(`🏷️ Updating tags for image: ${imageId}`);
        if (this.imageData.has(imageId)) {
            const currentData = this.imageData.get(imageId);
            const updatedData = {
                ...currentData,
                tags: Array.isArray(tags) ? tags : [],
                aiProcessed: true,
                processed: true
            };
            this.imageData.set(imageId, updatedData);
            this.saveImageData(imageId);
            this.onImageChange('update', updatedData);
            return true;
        }
        return false;
    }

    updateImageOCR(imageId, ocrText) {
        console.log(`📝 Updating OCR text for image: ${imageId}`);
        if (this.imageData.has(imageId)) {
            const currentData = this.imageData.get(imageId);
            const updatedData = {
                ...currentData,
                ocrText,
                processed: true
            };
            this.imageData.set(imageId, updatedData);
            this.saveImageData(imageId);
            this.onImageChange('update', updatedData);
            return true;
        }
        return false;
    }

    addNewImage(imagePath) {
        const imageId = path.basename(imagePath);  
        if (!this.imageData.has(imageId)) {
         console.log(`📸 Adding new image: ${imageId}`);
            const newImageData = this.createBaseImageData(imageId, imagePath);
            this.imageData.set(imageId, newImageData);

            this.saveImageData(imageId);
            this.onImageChange('add', newImageData);
            return newImageData;
        }
        return this.imageData.get(imageId);
    }

    getImageData(imageId) {
        return this.imageData.get(imageId);
    }

    getAllImagesData() {
        return Array.from(this.imageData.values());
    }

    saveImageData(imageId = null) {
        try {
            this.ensureDataFile();
            if (imageId) {
                // If we have a specific imageId, update just that entry
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                data[imageId] = this.imageData.get(imageId);
                fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
                console.log(`💾 Saved data for image: ${imageId}`);
            } else {
                // If no imageId provided, save all data (used during initialization)
                const data = Object.fromEntries(this.imageData);
                fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
                console.log(`💾 Saved data for all ${this.imageData.size} images`);
            }
        } catch (error) {
            console.error('❌ Error saving image data:', error);
        }
    }

    deleteImageData(imageId) {
        console.log(`🗑️ Deleting data for image: ${imageId}`);
        if (this.imageData.has(imageId)) {
            const imageData = this.imageData.get(imageId);
            this.imageData.delete(imageId);
            this.saveImageData();
            this.onImageChange('remove', imageData);
            return true;
        }
        console.log(`ℹ️ Image ${imageId} not found, deletion skipped`);
        return false;
    }

    clearAllImageData() {
        console.log('🗑️ Clearing all image data');
        this.imageData.clear();
        this.saveImageData();
        return true;
    }
}

module.exports = DataService; 