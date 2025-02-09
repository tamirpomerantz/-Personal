// =====================================================
// 1️⃣ SETUP & CONFIGURATION
// =====================================================
const express = require('express');
const app = express();
const path = require('path');
const sharp = require('sharp');
const PORT = 3000;
const fs = require('fs-extra');
const axios = require('axios');
require('dotenv').config(); // Add this line at the top of your file
const { createWorker } = require('tesseract.js');
let imageData;
const pageSize = 20;

// Images Directory:
const photosDir = path.join(__dirname, '../', '');

// Images JSON:
const jsonFilePath = path.join(__dirname, '/', 'images.json');
const apiKey = process.env.OPENAI_API_KEY; // Use the environment variable
// Ensure the JSON file exists, create an empty one if it doesn't
(async () => {
  if (!await fs.pathExists(jsonFilePath)) {
    await fs.writeJson(jsonFilePath, {}, { spaces: 2 });
    console.log('Created an empty images.json file.');
  }
  
  // Call getImagesData after ensuring the file exists
  imageData = getImagesData();
})();


// =====================================================
// 2️⃣ CONSTANTS (PROMPT)
// =====================================================
const CONST_PROMPT = `    
describe the image accurately for a searchable database. Focus on specific elements instead of generic terms like “image,” “photo,” or “screenshot.” Identify key components, themes, or subjects based on the image type (e.g., UI elements, design patterns, objects, actions, or visual styles).
You are an image classification expert generating highly relevant, clear, and searchable tags for images, ensuring precise categorization.
Describe the image in two sentences (mention key details and composition).
think of 3-4 tags that are useful for this image.
then, List 2-5 of the colors in the image, use only these:  "Red",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Orange",
  "Lime",
  "Aqua",
  "Teal",
  "Black",
  "White",
  "Brown",
  "Peach",
  "Maroon",
  "Gray",
  "Blue Gray",
  "Pea Green",
  "Cyan",
  "Navy Blue",
  "Pink",
  "Mustard",
  "Coral",
  "Monochrome",
  "Hot Pink"
Example
“This is a web dashboard with a sidebar, filter toolbar, and a sortable data table. It features KPI metrics, export options, and an expand/collapse row feature.”
<colors>Pink, Coral</colors>
<tags>Button, Toggle, Onboarding</tags>
`;

// =====================================================
// 3️⃣ UTILITY FUNCTIONS (IMAGE PROCESSING)
// =====================================================
const encodeImage = async (imagePath) => {
  const imageBuffer = await fs.readFile(imagePath);
  return imageBuffer.toString('base64');
};

function extractTags(inputText) {
  // Finding the start index of the tag
  let start = inputText.indexOf('<tags>') + 6;
  if (start === 5) {
      // '<tags>' not found, return empty array
      return [];
  }

  // Finding the end index of the tag
  let end = inputText.indexOf('</tags>', start);
  if (end === -1) {
      // '</tags>' not found, return empty array
      return [];
  }

  // Extracting the text between '<tags>' and '</tags>'
  let tagString = inputText.substring(start, end).trim();

  // Checking if there is any content to split
  if (tagString === '') {
      return [];
  }

  // Splitting the tags by comma and trimming any whitespace around the tags
  let tags = tagString.split(',').map(tag => tag.trim());

  return tags;
}

function extractColors(inputText) {
  // Finding the start index of the tag
  let start = inputText.indexOf('<colors>') + 8;
  if (start === 7) {
      // '<tags>' not found, return empty array
      return [];
  }

  // Finding the end index of the tag
  let end = inputText.indexOf('</colors>', start);
  if (end === -1) {
      // '</tags>' not found, return empty array
      return [];
  }

  // Extracting the text between '<tags>' and '</tags>'
  let tagString = inputText.substring(start, end).trim();

  // Checking if there is any content to split
  if (tagString === '') {
      return [];
  }

  // Splitting the tags by comma and trimming any whitespace around the tags
  let tags = tagString.split(',').map(tag => tag.trim());

  return tags;
}

function removeTagsAndNewlines(inputString) {
  // Use a regular expression to remove all tags, their content, and newlines
  return inputString.replace(/<[^>]*>.*?<\/[^>]*>/gs, '').replace(/\n/g, '');
}

// =====================================================
// 4️⃣ AI TAGGING REQUEST FUNCTION
// =====================================================
const getTagsFromOpenAI = async (base64Image) => {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  const body = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: CONST_PROMPT
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 300
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, { headers });
    console.log(response.data.choices[0].message)
    return {tags:extractTags(response.data.choices[0].message.content),context:removeTagsAndNewlines(response.data.choices[0].message.content), colors:extractColors(response.data.choices[0].message.content)};
  } catch (error) {
    console.error('Failed to get tags from OpenAI:', error);
    return [];
  }
};

// =====================================================
// 5️⃣ OCR & IMAGE RESIZING FUNCTIONS
// =====================================================
const performOCR = async (imagePath) => {
  const worker = await createWorker();
  try {
    const { data: { text } } = await worker.recognize(imagePath);
    return text.trim();
  } finally {
    await worker.terminate();
  }
};

const resizeImage = async (imagePath) => {
  const metadata = await sharp(imagePath).metadata();
  const maxDim = 550;
  
  if (metadata.width > maxDim || metadata.height > maxDim) {
    const scaleFactor = maxDim / Math.max(metadata.width, metadata.height);
    const newWidth = Math.round(metadata.width * scaleFactor);
    const newHeight = Math.round(metadata.height * scaleFactor);

    const resizedImagePath = `${path.parse(imagePath).name}-resized${path.parse(imagePath).ext}`;
    await sharp(imagePath)
      .resize(newWidth, newHeight)
      .toFile(resizedImagePath);

    return resizedImagePath;
  }
  return imagePath;
};
// =====================================================
// 6️⃣ UPDATE JSON DATABASE FUNCTION & STARTUP CALL
// =====================================================
const updateJSONFile = async () => {
  try {
    let imageData = {};

    // Check if the JSON file exists, if not, create an empty file
    if (await fs.pathExists(jsonFilePath)) {
      imageData = await fs.readJson(jsonFilePath);
    } else {
      // Create an empty JSON file if it doesn't exist
      await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
    }

    const photoFiles = await fs.readdir(photosDir);

    // Create a new object to store new images
    const newImageData = {};
    for (const photo of photoFiles) {
      if (!imageData[photo] && /\.(jpg|jpeg|png|gif|webp)$/i.test(photo)) {
        const photoPath = path.join(photosDir, photo);
        const resizedPhotoPath = await resizeImage(photoPath);
        const text = await performOCR(resizedPhotoPath);
        const base64Image = await encodeImage(resizedPhotoPath);
        const tags = await getTagsFromOpenAI(base64Image);
        
        // Add date and time of addition
        const dateAdded = new Date().toISOString();
        
        newImageData[photo] = { text, tags, date: dateAdded };

        if (resizedPhotoPath !== photoPath) {
          await fs.remove(resizedPhotoPath); // Clean up the resized image file
        }
      }
    }

    // Merge existing imageData with newImageData, ensuring new images are added at the end
    const updatedImageData = { ...imageData, ...newImageData };

    await fs.writeJson(jsonFilePath, updatedImageData, { spaces: 2 });
    console.log('Updated images.json successfully!');
  } catch (err) {
    console.error('Error processing images:', err);
  }
};

updateJSONFile();

// =====================================================
// 7️⃣ EXPRESS STATIC FILE SERVING SETUP
// =====================================================
// Define the path to the images directory (one level above server.js)
const imagesDir = path.join(__dirname, '..', '');

// Serve static files from the images directory when the URL starts with /photos
app.use('/photos', express.static(imagesDir));

app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// =====================================================
// 8️⃣ ADDITIONAL UTILITY FUNCTIONS FOR IMAGES
// =====================================================
const getImageDimensions = async (path) => {
    try {
      const metadata = await sharp(path).metadata();
      return { width: metadata.width, height: metadata.height };
    } catch (error) {
      console.error('Error getting image dimensions:', error);
      return { width: 0, height: 0 };
    }
};

const getImagesData = () => {
    // Read and parse the images.json file
    const data = fs.readFileSync(jsonFilePath, 'utf-8');

    const jsonData = JSON.parse(data);
    // Convert the object into an array of entries, reverse it, and then reconstruct as an object
    const reversedData = Object.keys(jsonData)
        .reverse() // Reverse the order of keys
        .reduce((acc, key) => {
            acc[key] = jsonData[key]; // Rebuild object with keys in reversed order
            return acc;
        }, {});

    return reversedData;
};
// const imageData = getImagesData();

// In-memory store for search results order
const searchResultsOrder = {};

// =====================================================
// 9️⃣ API ENDPOINTS
// =====================================================

// API endpoint to get image data with pagination and optional search
app.get('/api/images', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search?.toLowerCase();
  const shuffle = req.query.shuffle === 'true'; // Check if shuffle parameter is set to 'true'
  console.log(`Requested page ${page} of query ${search} and shuffle ${shuffle}`);

  // Generate a unique key for the search query
  const searchKey = search || 'all';

  // Check if we already have a randomized order for this search query and if the shuffle state has changed
  if (!searchResultsOrder[searchKey] || searchResultsOrder[searchKey].shuffle !== shuffle) {
    // Get all keys and sort them in reverse chronological order
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

    // Randomize the order of filtered keys if shuffle is true
    const orderedKeys = shuffle ? filteredKeys.sort(() => Math.random() - 0.5) : filteredKeys;

    // Store the ordered keys and shuffle state
    searchResultsOrder[searchKey] = { keys: orderedKeys, shuffle };
  }

  const paginatedKeys = searchResultsOrder[searchKey].keys.slice((page - 1) * pageSize, page * pageSize);

  const imagesToShowPromises = paginatedKeys.map(async key => {
    const imagePath = `../${key}`;
    if (fs.existsSync(imagePath)) {
      const dimensions = await getImageDimensions(imagePath);
      return {
        // src:adjustImagePath(`/photos/${key}`),
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

  res.json(imagesToShow);
});


// Route for filtering by tag
app.get('/filter', (req, res) => {
    const tag = req.query.tag.toLowerCase(); // Convert the tag to lowercase to ensure case-insensitive matching
    const filteredImages = Object.keys(imageData).filter(key => {
        const imageTags = imageData[key].tags.tags;
        // Ensure that imageTags is defined and is an array before attempting to call includes
        return Array.isArray(imageTags) && imageTags.map(t => t.toLowerCase()).includes(tag);
    }).map(key => ({
        src: key,
        tags: imageData[key].tags.tags // Assuming this is always an array as per your JSON structure
    }));

    res.json(filteredImages);
});

// Route for autocomplete suggestions
app.get('/autocomplete', (req, res) => {
  const keyword = req.query.keyword.toLowerCase();
  const tagCounts = {};

  Object.values(imageData).forEach(data => {
      // Check if tags is an array and not undefined or null
      if (Array.isArray(data.tags.tags)) {
          data.tags.tags.forEach(tag => {
              // Ensure the tag is a string and not empty
              if (typeof tag === 'string' && tag.trim() !== '') {
                  if (tag.toLowerCase().includes(keyword)) {
                      if (!tagCounts[tag]) {
                          tagCounts[tag] = 0;
                      }
                      tagCounts[tag]++;
                  }
              }
          });
      }
  });

  // Convert the tagCounts object to an array of objects with tag and count
  const result = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count }));

  res.json(result);
});


// Existing routes and functionalities
// Route for searching images
app.get('/search', (req, res) => {
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

app.get('/image-info', (req, res) => {
    // Decode the imageName to handle spaces encoded as %20
    const imageName = decodeURIComponent(req.query.imageName);
    console.log('Received imageName:', imageName); // Log the imageName to debug

    // Now we can safely assume that imageName has spaces instead of %20, if it had any
    const info = imageData[imageName];

    if (info) {
        res.json({ tags: info.tags.tags, context: info.tags.context });
    } else {
        // If not found, send a 404 error with a message
        res.status(404).json({ error: 'Image not found' });
    }
});



// Function to remove a tag from a specific image
const removeTagFromImage = async (imageName, tagToRemove) => {
  if (imageData[imageName] && Array.isArray(imageData[imageName].tags.tags)) {
    imageData[imageName].tags.tags = imageData[imageName].tags.tags.filter(tag => tag !== tagToRemove);
    await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
    console.log(`Removed tag "${tagToRemove}" from image "${imageName}".`);
  } else {
    console.warn(`Image "${imageName}" not found or has no tags.`);
  }
};

// Function to add a tag to a specific image
const addTagToImage = async (imageName, tagToAdd) => {
  if (imageData[imageName]) {
    if (!Array.isArray(imageData[imageName].tags.tags)) {
      imageData[imageName].tags.tags = [];
    }
    if (!imageData[imageName].tags.tags.includes(tagToAdd)) {
      imageData[imageName].tags.tags.push(tagToAdd);
      await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
      console.log(`Added tag "${tagToAdd}" to image "${imageName}".`);
    } else {
      console.log(`Tag "${tagToAdd}" already exists for image "${imageName}".`);
    }
  } else {
    console.warn(`Image "${imageName}" not found.`);
  }
};

// Function to update the description of a specific image
const updateImageDescription = async (imageName, newDescription) => {
  if (imageData[imageName]) {
    imageData[imageName].tags.context = newDescription;
    await fs.writeJson(jsonFilePath, imageData, { spaces: 2 });
    console.log(`Updated description for image "${imageName}".`);
  } else {
    console.warn(`Image "${imageName}" not found.`);
  }
};


// API endpoint to remove a tag from a specific image
app.delete('/api/images/:imageName/tags/:tag', async (req, res) => {
  const { imageName, tag } = req.params;
  try {
    await removeTagFromImage(imageName, tag);
    res.status(200).json({ message: `Tag "${tag}" removed from image "${imageName}".` });
  } catch (error) {
    res.status(500).json({ error: `Failed to remove tag: ${error.message}` });
  }
});

// API endpoint to add a tag to a specific image
app.post('/api/images/:imageName/tags', async (req, res) => {
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
app.put('/api/images/:imageName/description', async (req, res) => {
  const { imageName } = req.params;
  const { description } = req.body;
  try {
    await updateImageDescription(imageName, description);
    res.status(200).json({ message: `Description updated for image "${imageName}".` });
  } catch (error) {
    res.status(500).json({ error: `Failed to update description: ${error.message}` });
  }
});


// =====================================================
// 🔟 START THE SERVER
// =====================================================
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});