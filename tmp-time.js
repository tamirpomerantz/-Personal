const fs = require('fs');

// Load the JSON file
const jsonFilePath = 'images.json'; // Change this to your actual file path
const outputFilePath = 'cleaned_data.json';

// Read and parse the JSON data
fs.readFile(jsonFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading JSON file:', err);
        return;
    }
    
    try {
        const jsonData = JSON.parse(data);
        let startTime = new Date();
        
        // Process each image entry
        Object.keys(jsonData).forEach((key, index) => {
            if (jsonData[key].tags && jsonData[key].tags.tags) {
                jsonData[key].tags.tags = jsonData[key].tags.tags.slice(0, 5);
            }
            
            // Add date and time of addition
            const dateAdded = new Date(startTime.getTime() + index * 1000).toISOString();
            jsonData[key].date = dateAdded;
        });

        // Write the modified JSON back to a file
        fs.writeFile(outputFilePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing JSON file:', err);
            } else {
                console.log('JSON file successfully updated:', outputFilePath);
            }
        });
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
    }
});
