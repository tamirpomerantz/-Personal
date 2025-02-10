// public/js/utils.js
function isColorDarkerThanGray(rgbaColor) {
    console.log(rgbaColor);
    const rgba = rgbaColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!rgba) {
      throw new Error('Invalid RGBA color format');
    }
    const [_, r, g, b] = rgba.map(Number);
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
    return brightness < 128;
  }
  
  async function getKeyColor(imgElement) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Ensure the image is fully loaded
        imgElement.onload = () => {
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;

            // Draw the image onto the canvas
            ctx.drawImage(imgElement, 0, 0);

            // Get the image data
            const { width, height } = canvas;
            const imageData = ctx.getImageData(0, 0, width, height).data;

            const colorHistogram = new Map();

            // Helper function to convert RGBA to a key
            const rgbaToKey = (r, g, b) => `${r},${g},${b}`;

            // Scan the edge pixels
            const scanEdges = () => {
                // Top and bottom edges
                for (let x = 0; x < width; x++) {
                    // Top edge
                    const topIdx = (x * 4);
                    const topKey = rgbaToKey(imageData[topIdx], imageData[topIdx + 1], imageData[topIdx + 2]);
                    colorHistogram.set(topKey, (colorHistogram.get(topKey) || 0) + 1);

                    // Bottom edge
                    const bottomIdx = ((height - 1) * width + x) * 4;
                    const bottomKey = rgbaToKey(imageData[bottomIdx], imageData[bottomIdx + 1], imageData[bottomIdx + 2]);
                    colorHistogram.set(bottomKey, (colorHistogram.get(bottomKey) || 0) + 1);
                }

                // Left and right edges
                for (let y = 0; y < height; y++) {
                    // Left edge
                    const leftIdx = y * width * 4;
                    const leftKey = rgbaToKey(imageData[leftIdx], imageData[leftIdx + 1], imageData[leftIdx + 2]);
                    colorHistogram.set(leftKey, (colorHistogram.get(leftKey) || 0) + 1);

                    // Right edge
                    const rightIdx = (y * width + (width - 1)) * 4;
                    const rightKey = rgbaToKey(imageData[rightIdx], imageData[rightIdx + 1], imageData[rightIdx + 2]);
                    colorHistogram.set(rightKey, (colorHistogram.get(rightKey) || 0) + 1);
                }
            };

            scanEdges();

            // Find the most common color
            let mostCommonColor = null;
            let maxCount = 0;

            for (const [color, count] of colorHistogram.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonColor = color;
                }
            }

            if (mostCommonColor) {
                resolve({ closestMatch: `rgb(${mostCommonColor})` });
            } else {
                reject("No color detected.");
            }
        };

        imgElement.onerror = () => reject("Failed to load the image.");
        imgElement.crossOrigin = "anonymous"; // Avoid CORS issues for cross-origin images
    });
}



  export { isColorDarkerThanGray, getKeyColor };