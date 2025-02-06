function getKeyColor(imgElement, colorPalette = []) {
  return new Promise((resolve, reject) => {
    if (!(imgElement instanceof HTMLImageElement)) {
      return reject(new Error("Invalid image element"));
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    imgElement.crossOrigin = "Anonymous";
    imgElement.onload = () => {
      canvas.width = imgElement.width;
      canvas.height = imgElement.height;
      ctx.drawImage(imgElement, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = [];

      for (let i = 0; i < imageData.length; i += 4 * 10) { // Sample every 10 pixels
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];

        if (imageData[i + 3] === 0) continue; // Ignore transparent pixels

        const hsv = rgbToHsv(r, g, b);
        colors.push({ r, g, b, ...hsv });
      }

      // Sort by saturation and contrast (prioritizing vividness)
      colors.sort((a, b) => {
        if (b.s - a.s !== 0) return b.s - a.s; // Higher saturation first
        return Math.abs(128 - (b.v * 255)) - Math.abs(128 - (a.v * 255)); // Contrast from mid-gray
      });

      const keyColor = colors[0]; // Most vivid color
      const keyColorHex = rgbToHex(keyColor.r, keyColor.g, keyColor.b);

      // Find the closest color from the palette based on hue
      let closestColor = null;
      if (colorPalette.length > 0) {
        const keyHue = keyColor.h * 360;
        closestColor = colorPalette.reduce((closest, currentColor) => {
          const currentRgb = hexToRgb(currentColor);
          const currentHsv = rgbToHsv(...currentRgb);
          const hueDiff = Math.abs(currentHsv.h * 360 - keyHue);

          return hueDiff < closest.diff ? { color: currentColor, diff: hueDiff } : closest;
        }, { color: null, diff: Infinity }).color;
      }

      resolve({ keyColor: keyColorHex, closestMatch: closestColor });
    };

    imgElement.onerror = () => reject(new Error("Image loading failed"));
    imgElement.src = imgElement.src; // Trigger onload
  });
}

// Convert RGB to HSV (Hue, Saturation, Value)
function rgbToHsv(r, g, b) {
  r /= 255, g /= 255, b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;

  let d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0;
  } else {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  return { h, s, v };
}

// Convert RGB to HEX
function rgbToHex(r, g, b) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

// Convert HEX to RGB
function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map(x => x + x).join(""); // Convert #RGB to #RRGGBB
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Usage Example:
// const img = document.querySelector("img");
// const palette = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
// getKeyColor(img, palette).then(result => console.log(result));