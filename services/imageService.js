/**
 * ImageService - Central service for image processing and management
 * 
 * Interface:
 * - Exports: ImageService class
 * - Dependencies: DataService, SearchService, DOMManager, AIService
 * 
 * Public Methods:
 * - loadImages(): Load and process all images
 * - processImage(filePath, fileName, fileUrl): Process new image with OCR and AI
 * - cropImage(imagePath, cropData): Crop and rotate image
 * - saveImageData(imageData): Save image metadata using individual update methods
 * - clearStore(): Clear all image data
 * - dispose(): Clean up resources
 * - getImageBase64(filePath): Get base64 representation of image
 * 
 * Events Emitted:
 * - 'image-added': When new image is added
 * - 'image-deleted': When image is removed
 * - 'image-updated': When image data is updated
 * - 'image-processed': When image processing completes
 * - 'store-cleared': When all data is cleared
 * 
 * Interacts with:
 * - DataService: For file system operations and data persistence
 * - SettingsService: For AI and processing settings
 * - AIService: For image analysis and tagging
 */

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const chokidar = require('chokidar');
const EventEmitter = require('events');
const sharp = require('sharp');
const os = require('os');
let isLoaded = false;

class ImageService extends EventEmitter {
    constructor(personalPath, dataService, settingsService, aiService) {
        super();
        this.personalPath = personalPath;
        this.dataService = dataService;
        this.settingsService = settingsService;
        this.aiService = aiService;
        this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
        this.processingFiles = new Set();
        this.watcher = null;

        // Initialize file watcher
        this.initializeWatcher();
    }

    initializeWatcher() {
        this.watcher = chokidar.watch(this.personalPath, {
            // Ignore hidden files and non-image files
            ignored: (path) => {
                const isHidden = /(^|[\/\\])\../.test(path);
                const isImage = this.isImageFile(path);
                return isHidden || !isImage;
            },
            persistent: true,
            ignoreInitial: true
        });

        this.watcher
            .on('add', async (filePath) => {
                if (this.isImageFile(filePath)) {
                    console.log(`🖼️ New image detected: ${filePath}`);
                    await this.handleNewImage(filePath);
                }
            })
            .on('unlink', (filePath) => {
                if (this.isImageFile(filePath)) {
                    console.log(`🗑️ Image removed: ${filePath}`);
                    this.handleDeletedImage(filePath);
                }
            });
    }

    async handleNewImage(filePath) {
        const fileName = path.basename(filePath);
        await this.processImageData(filePath);
    }

    handleDeletedImage(filePath) {
        const fileName = path.basename(filePath);
        this.dataService.deleteImageData(fileName);
    }

    isImageFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return this.imageExtensions.includes(ext);
    }

    async processImageData(imagePath) {
        const fileName = path.basename(imagePath);
        const stats = fs.statSync(imagePath);
        
        // Add new image to data service
        const imageData = this.dataService.addNewImage(imagePath);

        // Process OCR and AI tagging in parallel if enabled
        const tasks = [];
        const settings = this.settingsService.getAISettings();
        
        // OCR processing
        if (settings.autoTag && !imageData.processed && !this.processingFiles.has(fileName)) {
            this.processingFiles.add(fileName);
            tasks.push((async () => {
                try {
                    const text = await ipcRenderer.invoke('perform-ocr', imagePath);
                    if (text) {
                        this.dataService.updateImageOCR(fileName, text);
                    }
                } catch (error) {
                    console.error('❌ OCR Error for ' + imagePath + ':', error);
                } finally {
                    this.processingFiles.delete(fileName);
                }
            })());
        }

        // AI tagging if enabled and no existing tags
        if (settings.autoTag && 
            (!imageData.tags || imageData.tags.length === 0) && 
            !imagePath.toLowerCase().endsWith('.webp')) {
            tasks.push((async () => {
                try {
                    const imageBase64 = await this.getImageBase64(imagePath);
                    const aiResult = await this.aiService.generateImageDescription(imageBase64);
                    if (aiResult) {
                        if (aiResult.title) {
                            this.dataService.updateImageTitle(fileName, aiResult.title);
                        }
                        if (aiResult.description) {
                            this.dataService.updateImageDescription(fileName, aiResult.description);
                        }
                        if (aiResult.tags && aiResult.tags.length > 0) {
                            this.dataService.updateImageTags(fileName, aiResult.tags);
                        }
                    }
                } catch (error) {
                    console.error('❌ AI Tagging Error for ' + imagePath + ':', error);
                }
            })());
        }

        // Wait for all tasks to complete
        await Promise.all(tasks);
        return this.dataService.getImageData(fileName);
    }

    async loadImages() {
        if (!fs.existsSync(this.personalPath)) {
            fs.mkdirSync(this.personalPath);
        }

        console.log(`📂 Loading images from: ${this.personalPath}`);
        const files = fs.readdirSync(this.personalPath)
            .filter(file => this.isImageFile(file))
            .map(file => {
                const filePath = path.join(this.personalPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    filePath: filePath,
                    mtime: stats.mtime,
                    birthtime: stats.birthtime
                };
            })
            .sort((a, b) => b.mtime - a.mtime);
            
        
        console.log(`📊 Found ${files.length} image files`);

        // Process all images
        const images = await Promise.all(files.map(async file => {
            return await this.processImageData(file.filePath);
        }));

        // Second pass: Process unprocessed images in background
        const unprocessedCount = images.filter(img => !img.processed).length;
        console.log(`✅ Initial load complete. ${images.length} total images, ${unprocessedCount} need processing.`);
        if (unprocessedCount > 0) {
            this.processImagesInBackground(images);
        }
        isLoaded = true;    
        return images;
    }

    async processImagesInBackground(images) {
        const BATCH_SIZE = 3;
        const unprocessedImages = images.filter(img => !img.processed);
        
        if (unprocessedImages.length === 0) {
            console.log('✨ All images are already processed');
            return;
        }
        
        console.log(`🔄 Starting background processing of ${unprocessedImages.length} unprocessed images`);
        
        for (let i = 0; i < unprocessedImages.length; i += BATCH_SIZE) {
            const batch = unprocessedImages.slice(i, i + BATCH_SIZE);
            console.log(`⚡ Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(unprocessedImages.length/BATCH_SIZE)}`);
            
            await Promise.all(batch.map(async (image) => {
                try {
                    console.log(`🔍 Processing image ${image.name}`);
                    await this.processImageData(image.filePath);
                } catch (error) {
                    console.error(`❌ Error processing image ${image.name}:`, error);
                }
            }));
        }
        
        console.log('🎉 Completed background processing of all images');
    }

    async saveImageData(imageData) {
        try {
            // Update individual fields
            if (imageData.title !== undefined) {
                await this.dataService.updateImageTitle(imageData.name, imageData.title);
            }
            if (imageData.description !== undefined) {
                await this.dataService.updateImageDescription(imageData.name, imageData.description);
            }
            if (imageData.tags !== undefined) {
                await this.dataService.updateImageTags(imageData.name, imageData.tags);
            }
            
            // Emit the update event
            this.emit('image-updated', imageData);
            return imageData;
        } catch (error) {
            console.error('Error saving image data:', error);
            throw error;
        }
    }

    clearStore() {
        if (this.dataService.clearAllImageData()) {
            this.emit('store-cleared');
        }
    }

    dispose() {
        if (this.watcher) {
            this.watcher.close();
        }
    }

    async getImageBase64(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp',
                '.tiff': 'image/tiff'
            };

            const buffer = await fs.promises.readFile(filePath);
            const base64 = buffer.toString('base64');
            
            return {
                base64,
                mediaType: mimeTypes[ext] || 'image/jpeg'
            };
        } catch (error) {
            console.error('❌ Error reading image file:', error);
            throw error;
        }
    }

    async cropImage(imagePath, cropData) {
        try {
            const { x, y, width, height, rotation } = cropData;
            const fileName = path.basename(imagePath);
            const ext = path.extname(fileName);
            // Use system temp directory and add a unique timestamp
            const tempPath = path.join(os.tmpdir(), `ele_crop_${Date.now()}_${fileName}`);
            
            // Get image metadata first
            const metadata = await sharp(imagePath).metadata();
            
            // Validate crop dimensions
            const validX = Math.max(0, Math.min(x, metadata.width - 1));
            const validY = Math.max(0, Math.min(y, metadata.height - 1));
            const validWidth = Math.max(1, Math.min(width, metadata.width - validX));
            const validHeight = Math.max(1, Math.min(height, metadata.height - validY));
            
            // Create a sharp instance for image processing
            let sharpInstance = sharp(imagePath);
            
            // Apply rotation if needed (before crop)
            if (rotation !== 0) {
                const normalizedRotation = ((rotation % 360) + 360) % 360;
                sharpInstance = sharpInstance.rotate(normalizedRotation);
            }
            
            // Apply crop with validated dimensions
            sharpInstance = sharpInstance.extract({
                left: Math.round(validX),
                top: Math.round(validY),
                width: Math.round(validWidth),
                height: Math.round(validHeight)
            });
            
            // Ensure output format matches input
            if (ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg') {
                sharpInstance = sharpInstance.jpeg({ quality: 100 });
            } else if (ext.toLowerCase() === '.png') {
                sharpInstance = sharpInstance.png({ quality: 100 });
            }
            
            // Save to temporary file first
            await sharpInstance.toFile(tempPath);
            
            // Safely replace the original file
            await fs.promises.unlink(imagePath);
            await fs.promises.rename(tempPath, imagePath);
            
            // Get fresh image data
            const imageData = this.dataService.getImageData(fileName);
            if (imageData) {
                this.emit('image-updated', imageData);
            }
            
            return true;
        } catch (error) {
            // Clean up temp file if it exists
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            console.error('Error cropping image:', error);
            throw error;
        }
    }

    async processImage(filePath, fileName, fileUrl) {
        try {
            // Create initial image data
            const imageData = {
                name: fileName,
                filePath,
                fileUrl,
                title: '',
                description: '',
                tags: []
            };

            // Save initial data
            if (imageData.title) {
                await this.dataService.updateImageTitle(fileName, imageData.title);
            }
            if (imageData.description) {
                await this.dataService.updateImageDescription(fileName, imageData.description);
            }
            if (imageData.tags) {
                await this.dataService.updateImageTags(fileName, imageData.tags);
            }

            // Emit the add event
            this.emit('image-added', imageData);

            // Process with AI if enabled
            const settings = this.settingsService.getAISettings();
            if (settings.autoTag && this.aiService) {
                try {
                    const base64Data = await this.getImageBase64(filePath);
                    const aiResult = await this.aiService.generateImageDescription(base64Data);
                    
                    // Update with AI results
                    if (aiResult.title) {
                        await this.dataService.updateImageTitle(fileName, aiResult.title);
                    }
                    if (aiResult.description) {
                        await this.dataService.updateImageDescription(fileName, aiResult.description);
                    }
                    if (aiResult.tags && aiResult.tags.length > 0) {
                        await this.dataService.updateImageTags(fileName, aiResult.tags);
                    }

                    // Emit the processed event
                    this.emit('image-processed', { ...imageData, ...aiResult });
                } catch (error) {
                    console.error('Error processing image with AI:', error);
                }
            }

            return imageData;
        } catch (error) {
            console.error('Error processing image:', error);
            throw error;
        }
    }
}

module.exports = ImageService; 