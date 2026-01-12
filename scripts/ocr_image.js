
import Tesseract from 'tesseract.js';
import path from 'path';

// Switching to the specific small image which might be the one
const imagePath = '/Users/amu/.gemini/antigravity/brain/d1a9c381-d90d-40de-82fc-80b0a94559ed/uploaded_image_1765848559969.png';

async function readImage() {
    console.log(`Reading image from ${imagePath}...`);
    try {
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'eng+kor', // English and Korean
            // { logger: m => console.log(m) }
        );
        console.log('--- Extracted Text ---');
        console.log(text);
        console.log('------');
    } catch (error) {
        console.error('Error reading image:', error);
    }
}

readImage();
