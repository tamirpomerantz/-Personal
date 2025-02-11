// routes/api.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { getImagesData, getImageDimensions } = require('../utils/imageUtils');
const { resizeImage, performOCR } = require('../utils/ocrResize');
const { encodeImage } = require('../utils/imageProcessing');
const { getTagsFromOpenAI } = require('../utils/aiTagging');
const { photosDir } = require('../utils/config');

// In-memory cache for image data and search ordering.
let imageData = getImagesData();
let searchResultsOrder = {};

// Function to refresh the image data cache
const refreshImageData = () => {
  imageData = getImagesData();
  searchResultsOrder = {}; // Clear search cache
};

// API endpoint to get image data with pagination and optional search
router.get('/images', async (req, res) => {
  // Refresh image data before processing the request
  refreshImageData();
  
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search?.toLowerCase();
  const shuffle = req.query.shuffle === 'true';
  const pageSize = 20;
  console.log(`Requested offset ${offset} of query ${search} and shuffle ${shuffle}`);

  const searchKey = search || 'all';

  if (!searchResultsOrder[searchKey] || searchResultsOrder[searchKey].shuffle !== shuffle) {
    const allKeys = Object.keys(imageData).sort((a, b) => {
      return new Date(imageData[b].date) - new Date(imageData[a].date);
    });

    const filteredKeys = allKeys.filter(key => {
      const { text, tags } = imageData[key];
      return (!search ||  
              (text && text.toLowerCase().includes(search)) || 
              (tags.context && tags.context.toLowerCase().includes(search)) || 
              (tags && tags.tags && Array.isArray(tags.tags) && tags.tags.some(tag => tag.toLowerCase().includes(search))));
    });

    const orderedKeys = shuffle ? filteredKeys.sort(() => Math.random() - 0.5) : filteredKeys;
    searchResultsOrder[searchKey] = { keys: orderedKeys, shuffle };
  }

  const paginatedKeys = searchResultsOrder[searchKey].keys.slice(offset, offset + pageSize);
  const hasMore = offset + pageSize < searchResultsOrder[searchKey].keys.length;

  const imagesToShowPromises = paginatedKeys.map(async key => {
    const imagePath = `../${key}`;
    if (fs.existsSync(imagePath)) {
      const dimensions = await getImageDimensions(imagePath);
      return {
        src: `photos/${encodeURIComponent(key)}`,
        text: imageData[key].text,
        tags: imageData[key].tags.tags,
        width: dimensions.width,
        height: dimensions.height,
        date: imageData[key].date
      };
    } else {
      console.warn(`Image file not found: ${imagePath}`);
      return null;
    }
  });

  const imagesToShow = (await Promise.all(imagesToShowPromises)).filter(Boolean);
  res.json({
    images: imagesToShow,
    hasMore: hasMore
  });
});

// Route for filtering by tag
router.get('/filter', (req, res) => {
    const tag = req.query.tag.toLowerCase();
    const filteredImages = Object.keys(imageData).filter(key => {
        const imageTags = imageData[key].tags.tags;
        return Array.isArray(imageTags) && imageTags.map(t => t.toLowerCase()).includes(tag);
    }).map(key => ({
        src: key,
        tags: imageData[key].tags.tags
    }));
    res.json(filteredImages);
});

// Route for autocomplete suggestions
router.get('/get-tags', (req, res) => {
  const keyword = req.query.keyword.toLowerCase();
  const tagCounts = {};

  Object.values(imageData).forEach(data => {
      if (Array.isArray(data.tags.tags)) {
          data.tags.tags.forEach(tag => {
              const lowerCaseTag = tag.toLowerCase(); // Convert tag to lowercase
              if (lowerCaseTag.includes(keyword)) {
                  if (!tagCounts[lowerCaseTag]) {
                      tagCounts[lowerCaseTag] = 0;
                  }
                  tagCounts[lowerCaseTag]++;
              }
          });
      }
  });
  const result = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count }));
  res.json(result);
});


// Route for searching images
router.get('/search', (req, res) => {
    const query = req.query.query.toLowerCase();
    const searchResults = Object.keys(imageData).filter(key => {
        const text = imageData[key].text ? imageData[key].text.toLowerCase() : '';
        const tags = Array.isArray(imageData[key].tags.tags)
            ? imageData[key].tags.tags.filter(tag => tag && typeof tag === 'string').map(tag => tag.toLowerCase())
            : [];
        return text.includes(query) || tags.some(tag => tag.includes(query));
    }).map(key => ({
        src: key,
        tags: imageData[key].tags.tags
    }));
    res.json(searchResults);
});

// Endpoint for image info
router.get('/image-info', (req, res) => {
    const imageName = decodeURIComponent(req.query.imageName);
    console.log('Received imageName:', imageName);
    const info = imageData[imageName];
    if (info) {
        res.json({ 
            tags: info.tags.tags, 
            context: info.tags.context,
            needsTagging: info.needsTagging || false
        });
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
});

// Helper functions for tag operations
const removeTagFromImage = async (imageName, tagToRemove) => {
  if (imageData[imageName] && Array.isArray(imageData[imageName].tags.tags)) {
    imageData[imageName].tags.tags = imageData[imageName].tags.tags.filter(tag => tag !== tagToRemove);
    const { jsonFilePath, fs } = require('../utils/config');
    await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
    console.log(`Removed tag "${tagToRemove}" from image "${imageName}".`);
  } else {
    console.warn(`Image "${imageName}" not found or has no tags.`);
  }
};

const addTagToImage = async (imageName, tagToAdd) => {
  if (imageData[imageName]) {
    if (!Array.isArray(imageData[imageName].tags.tags)) {
      imageData[imageName].tags.tags = [];
    }
    if (!imageData[imageName].tags.tags.includes(tagToAdd)) {
      imageData[imageName].tags.tags.push(tagToAdd);
      const { jsonFilePath, fs } = require('../utils/config');
      await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
      console.log(`Added tag "${tagToAdd}" to image "${imageName}".`);
    } else {
      console.log(`Tag "${tagToAdd}" already exists for image "${imageName}".`);
    }
  } else {
    console.warn(`Image "${imageName}" not found.`);
  }
};

const updateImageDescription = async (imageName, newDescription) => {
  if (imageData[imageName]) {
    imageData[imageName].tags.context = newDescription;
    const { jsonFilePath, fs } = require('../utils/config');
    await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
    console.log(`Updated description for image "${imageName}".`);
  } else {
    console.warn(`Image "${imageName}" not found.`);
  }
};

// API endpoint to remove a tag from a specific image
router.delete('/images/:imageName/tags/:tag', async (req, res) => {
  const { imageName, tag } = req.params;
  try {
    await removeTagFromImage(imageName, tag);
    res.status(200).json({ message: `Tag "${tag}" removed from image "${imageName}".` });
  } catch (error) {
    res.status(500).json({ error: `Failed to remove tag: ${error.message}` });
  }
});

// API endpoint to add a tag to a specific image
router.post('/images/:imageName/tags', async (req, res) => {
  const { imageName } = req.params;
  const { tag } = req.body;
  try {
    await addTagToImage(imageName, tag);
    res.status(200).json({ message: `Tag "${tag}" added to image "${imageName}".` });
  } catch (error) {
    res.status(500).json({ error: `Failed to add tag: ${error.message}` });
  }
});

// API endpoint to update the description of a specific image
router.put('/images/:imageName/description', async (req, res) => {
  const { imageName } = req.params;
  const { description } = req.body;
  try {
    await updateImageDescription(imageName, description);
    res.status(200).json({ message: `Description updated for image "${imageName}".` });
  } catch (error) {
    res.status(500).json({ error: `Failed to update description: ${error.message}` });
  }
});

// API endpoint to retag an image using AI
router.post('/retag-image', async (req, res) => {
  const { imageName } = req.body;
  
  try {
    if (!imageData[imageName]) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const photoPath = path.join(photosDir, imageName);
    const resizedPhotoPath = await resizeImage(photoPath);
    const text = await performOCR(resizedPhotoPath);
    const base64Image = await encodeImage(resizedPhotoPath);
    const tags = await getTagsFromOpenAI(base64Image);

    // Update image data with new tags and remove the needsTagging flag
    imageData[imageName] = {
      ...imageData[imageName],
      text,
      tags,
      needsTagging: false
    };

    // Save updated data to JSON file
    const { jsonFilePath, fs } = require('../utils/config');
    await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });

    if (resizedPhotoPath !== photoPath) {
      await fs.remove(resizedPhotoPath);
    }

    // Refresh the image data cache after updating
    refreshImageData();

    res.json({ 
      message: 'Image successfully retagged',
      tags: tags.tags,
      context: tags.context
    });
  } catch (error) {
    console.error('Error retagging image:', error);
    res.status(500).json({ error: 'Failed to retag image' });
  }
});

module.exports = router;