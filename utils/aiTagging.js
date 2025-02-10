// utils/aiTagging.js
const axios = require('axios');
const { apiKey } = require('./config');
const { extractTags, extractColors, removeTagsAndNewlines } = require('./imageProcessing');

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
          { type: "text", text: CONST_PROMPT },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
    max_tokens: 300
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, { headers });
    console.log(response.data.choices[0].message);
    return {
      tags: extractTags(response.data.choices[0].message.content),
      context: removeTagsAndNewlines(response.data.choices[0].message.content),
      colors: extractColors(response.data.choices[0].message.content)
    };
  } catch (error) {
    console.error('Failed to get tags from OpenAI:', error);
    return [];
  }
};

module.exports = { getTagsFromOpenAI };