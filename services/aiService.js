const { OpenAI } = require('openai');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const Jimp = require('jimp');
const webp = require('webp-converter');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const geminiModel = "gemini-2.0-flash-lite";

class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    async waitForSlot() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.timeWindow - (now - oldestRequest);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.waitForSlot();
        }
        
        this.requests.push(now);
        return true;
    }
}

class AIService {
    constructor(model = 'openai', apiKey = '', dataService = null) {
        this.model = model;
        this.apiKey = apiKey;
        this.dataService = dataService;
        this.client = null;
        this.fileManager = null;
        this.rateLimiter = new RateLimiter(20, 60000); // 5 requests per minute
        this.defaultPrompt = `You are a designer trying to create a library of references.
you see an image of a graphic design object - an interface , poster, book, typography or object.
try to describe the different elements in the photo in a detailed way so you can search it later. identify logos, brands and graphic concepts and elements.
avoid obvious things like "ui", "art", "design" "interface" or "graphic design", try using specific tags like "gradient", "status pill" and "monthly calendar" be creative and think about the context of the image. use the objects in the image to make up a story.
use max of 7 tags so choose them carefully
Please analyze this image`;
        this.mainPrompt = this.defaultPrompt;
        this.GeminiModel = geminiModel;
        this.initializeClient();
    }

    initializeClient() {
        switch (this.model) {
            case 'openai':
                this.client = new OpenAI({ apiKey: this.apiKey,   dangerouslyAllowBrowser: true  });
                break;
            case 'gemini':
                this.client = new GoogleGenerativeAI(this.apiKey);
                break;
            case 'claude':
                this.client = new Anthropic({
                    apiKey: this.apiKey,
                    dangerouslyAllowBrowser: true 
                });
                break;
        }
    }

    async scaleImage(imageBase64, mediaType) {
        const buffer = Buffer.from(imageBase64, 'base64');
        console.log('🖼️ Loading image with Jimp...');
        const image = await Jimp.read(buffer);
        
        // Scale the image to fit within 400x400 while maintaining aspect ratio
        if (image.bitmap.width > 400 || image.bitmap.height > 400) {
            image.scaleToFit(400, 400);
        }
        
        // Convert to JPG if not already JPG
        const outputMediaType = mediaType.toLowerCase() !== 'image/jpeg' 
            ? Jimp.MIME_JPEG 
            : mediaType;
        
        // Convert back to base64
        const scaledBuffer = await image.getBufferAsync(outputMediaType);
        return scaledBuffer.toString('base64');
    }

    async convertWebPToPNG(imageBase64, mediaType) {
        const tmpDir = os.tmpdir();
        const tmpWebP = path.join(tmpDir, `${uuidv4()}.webp`);
        const tmpPNG = path.join(tmpDir, `${uuidv4()}.png`);

        try {
            // Write base64 to temporary WebP file
            await fs.promises.writeFile(tmpWebP, Buffer.from(imageBase64, 'base64'));
            
            // Convert WebP to PNG
            await webp.dwebp(tmpWebP, tmpPNG, "-o");
            
            // Read PNG file and convert to base64
            const pngData = await fs.promises.readFile(tmpPNG);
            return {
                base64: pngData.toString('base64'),
                mediaType: 'image/png'
            };
        } finally {
            // Cleanup temporary files
            try {
                await fs.promises.unlink(tmpWebP);
                await fs.promises.unlink(tmpPNG);
            } catch (err) {
                console.warn('Error cleaning up temporary files:', err);
            }
        }
    }

    async generateImageDescription(imageData, options = {}) {
        console.log('🎨 Generating image description...');
        await this.rateLimiter.waitForSlot();
        try {
            if (imageData.mediaType?.toLowerCase() === 'image/webp') {
                console.log('🔄 Converting WebP image to PNG...');
                const convertedImage = await this.convertWebPToPNG(imageData.base64, imageData.mediaType);
                imageData = convertedImage;
            }

            let result;
            switch (this.model) {
                case 'openai':
                    result = await this.generateWithOpenAI(imageData, options);
                    break;
                case 'gemini':
                    result = await this.generateWithGemini(imageData, options);
                    break;
                case 'claude':
                    result = await this.generateWithClaude(imageData, options);
                    break;
                default:
                    throw new Error('Unsupported AI model');
            }

            // If dataService is available and fileName is provided in options, update the data
            if (this.dataService && options.fileName) {
                if (result.title) {
                    await this.dataService.updateImageTitle(options.fileName, result.title);
                }
                if (result.description) {
                    await this.dataService.updateImageDescription(options.fileName, result.description);
                }
                if (result.tags && result.tags.length > 0) {
                    await this.dataService.updateImageTags(options.fileName, result.tags);
                }
            }

            return result;
        } catch (error) {
            console.error('Error generating image description:', error);
            throw error;
        }
    }

    async generateWithOpenAI(imageData, options) {
        try {
            console.log('📝 Preparing OpenAI API request...');
            
            if (!imageData.base64 || imageData.base64.length === 0) {
                throw new Error('Empty base64 image data');
            }

            console.log('📤 Sending request to OpenAI API...');
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: this.mainPrompt
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${imageData.mediaType};base64,${imageData.base64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1024
            });

            console.log('📥 Received raw response from OpenAI API:', response);
            const content = response.choices[0].message.content;
            try {
                return JSON.parse(content);
            } catch (parseError) {
                console.error('❌ Failed to parse JSON response:', content);
                throw parseError;
            }
        } catch (error) {
            console.error('❌ OpenAI API error:', error);
            throw error;
        }
    }

    async generateWithGemini(imageData, options) {
        const maxRetries = 3;
        const retryDelay = 5000; // 5 seconds

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📝 Preparing Gemini API request (attempt ${attempt}/${maxRetries})...`);
                if (!imageData.base64 || imageData.base64.length === 0) {
                    throw new Error('Empty base64 image data');
                }

                const scaledBase64 = await this.scaleImage(imageData.base64, imageData.mediaType);
                console.log('✂️ Image scaled successfully');

                const model = this.client.getGenerativeModel({
                    model: this.GeminiModel,
                });

                const generationConfig = {
                    temperature: 1,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 9000,
                    responseMimeType: "application/json",
                    responseSchema: {
                      type: "object",
                      properties: {
                        title: {
                          type: "string",
                          description: "Brief title for the tagged image"
                        },
                        description: {
                          type: "string",
                          description: "Detailed description of the image"
                        },
                        tags: {
                          type: "array",
                          description: "List of relevant tags related to graphic design and UI/UX",
                          items: {
                            type: "string"
                          }
                        }
                      },
                      required: [
                        "title",
                        "description",
                        "tags"
                      ]
                    },
                  };

                const prompt = this.mainPrompt;

                const imagePart = {
                    inlineData: {
                        data: scaledBase64,
                        mimeType: imageData.mediaType
                    }
                };

                console.log('📤 Sending request to Gemini API...');
                const chatSession = model.startChat({
                    generationConfig,
                    history: []
                });

                const result = await chatSession.sendMessage([prompt, imagePart], generationConfig);
                console.log('📥 Received raw response from Gemini API:', result);
                const response = await result.response;
                const content = response.text();
                
                console.log('✅ Received response from Gemini API');
                const cleanContent = content.replace(/`|json\n?|\n?/g, '').trim();
                try {
                    return JSON.parse(cleanContent);
                } catch (parseError) {
                    console.error('❌ Failed to parse JSON response:', cleanContent);
                    throw parseError;
                }
            } catch (error) {
                console.error(`❌ Gemini API error (attempt ${attempt}/${maxRetries}):`, error);
                
                // Check if it's a 503 error and not the last attempt
                if (error.message?.includes('503') && attempt < maxRetries) {
                    console.log(`⏳ Model overloaded, waiting ${retryDelay/1000} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                throw error;
            }
        }
    }

    async generateWithClaude(imageData, options) {
        try {
            console.log('📝 Preparing Claude API request...');
            console.log('📏 Image base64 length:', imageData.base64.length);
            
            if (!imageData.base64 || imageData.base64.length === 0) {
                throw new Error('Empty base64 image data');
            }

            const requestBody = {
                model: 'claude-3-opus-20240229',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: this.mainPrompt
                        },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageData.mediaType,
                                data: imageData.base64
                            }
                        }
                    ]
                }]
            };

            console.log('📤 Sending request to Claude API with payload:', JSON.stringify(requestBody));
            const message = await this.client.messages.create(requestBody);
            console.log('📥 Received raw response from Claude API:', message);

            const content = message.content[0].text;
            try {
                return JSON.parse(content);
            } catch (parseError) {
                console.error('❌ Failed to parse JSON response:', content);
                throw parseError;
            }
        } catch (error) {
            console.error('❌ Claude API error:', error);
            if (error.response) {
                console.error('❌ Error response:', error.response.data);
            }
            throw error;
        }
    }

    setModel(model, apiKey) {
        this.model = model;
        this.apiKey = apiKey;
        this.initializeClient();
    }

    setMainPrompt(prompt) {
        this.mainPrompt = prompt || this.defaultPrompt;
    }
}

module.exports = AIService; 