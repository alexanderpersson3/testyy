import sharp from 'sharp';
/**
 * Preprocesses an image to improve OCR accuracy
 */
export async function preprocessImage(buffer) {
    try {
        // Get image metadata
        const metadata = await sharp(buffer).metadata();
        const { width = 0, height = 0, format = 'unknown' } = metadata;
        // Skip processing if image is too small
        if (width < 500 || height < 500) {
            return { buffer, format, width, height };
        }
        // Process the image
        const processedBuffer = await sharp(buffer)
            // Convert to grayscale
            .grayscale()
            // Increase contrast
            .linear(1.5, -0.2)
            // Remove noise using median filter
            .median(3)
            // Sharpen edges
            .sharpen({
            sigma: 2,
            m1: 0.5,
            m2: 0.5,
            x1: 2,
            y2: 10,
            y3: 20,
        })
            // Ensure consistent format
            .png({
            quality: 100,
            force: true,
        })
            // Resize if too large (keeping aspect ratio)
            .resize(2000, 2000, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .toBuffer();
        // Get processed image metadata
        const processedMetadata = await sharp(processedBuffer).metadata();
        return {
            buffer: processedBuffer,
            format: processedMetadata.format || 'png',
            width: processedMetadata.width || width,
            height: processedMetadata.height || height,
        };
    }
    catch (error) {
        console.error('Image preprocessing failed:', error);
        // Return original image if processing fails
        return { buffer, format: 'unknown', width: 0, height: 0 };
    }
}
/**
 * Detects and corrects skewed text in an image
 */
export async function deskewImage(buffer) {
    try {
        // Get image metadata
        const metadata = await sharp(buffer).metadata();
        const { width = 0, height = 0 } = metadata;
        // Skip deskewing if image is too small
        if (width < 500 || height < 500) {
            return buffer;
        }
        // Convert to grayscale for better edge detection
        const grayscale = await sharp(buffer).grayscale().toBuffer();
        // Detect edges using Canny algorithm
        const edges = await sharp(grayscale).threshold(128).toBuffer();
        // Use Hough transform to detect lines
        const angle = await detectSkewAngle(edges);
        // Rotate image to correct skew
        if (Math.abs(angle) > 0.5) {
            return await sharp(buffer).rotate(angle).toBuffer();
        }
        return buffer;
    }
    catch (error) {
        console.error('Image deskewing failed:', error);
        return buffer;
    }
}
/**
 * Detects text regions in an image and crops to the main content
 */
export async function cropToContent(buffer) {
    try {
        // Get image metadata
        const metadata = await sharp(buffer).metadata();
        const { width = 0, height = 0 } = metadata;
        // Skip cropping if image is too small
        if (width < 500 || height < 500) {
            return buffer;
        }
        // Convert to grayscale
        const grayscale = await sharp(buffer).grayscale().toBuffer();
        // Use adaptive thresholding to detect text regions
        const binary = await sharp(grayscale).threshold(128).toBuffer();
        // Find text regions using connected components
        const regions = await detectTextRegions(binary);
        // Crop to the main content region
        if (regions.length > 0) {
            const mainRegion = findMainRegion(regions);
            return await sharp(buffer)
                .extract({
                left: mainRegion.x,
                top: mainRegion.y,
                width: mainRegion.width,
                height: mainRegion.height,
            })
                .toBuffer();
        }
        return buffer;
    }
    catch (error) {
        console.error('Content cropping failed:', error);
        return buffer;
    }
}
// Helper functions
async function detectSkewAngle(edges) {
    // Simplified skew detection using horizontal projection
    try {
        const metadata = await sharp(edges).metadata();
        const { width = 0, height = 0 } = metadata;
        // Calculate horizontal projection profile
        const profile = new Array(height).fill(0);
        const pixels = await sharp(edges).raw().toBuffer();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (pixels[y * width + x] > 128) {
                    profile[y]++;
                }
            }
        }
        // Find peaks in profile
        const peaks = findPeaks(profile);
        // Calculate angle from peak positions
        if (peaks.length >= 2) {
            const angle = Math.atan2(peaks[peaks.length - 1] - peaks[0], (peaks.length - 1) * width) *
                (180 / Math.PI);
            return angle;
        }
        return 0;
    }
    catch (error) {
        console.error('Skew angle detection failed:', error);
        return 0;
    }
}
async function detectTextRegions(binary) {
    try {
        const metadata = await sharp(binary).metadata();
        const { width = 0, height = 0 } = metadata;
        // Use connected components to find text regions
        const regions = [];
        const pixels = await sharp(binary).raw().toBuffer();
        // Simple connected components algorithm
        const visited = new Set();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (pixels[idx] > 128 && !visited.has(idx)) {
                    const region = {
                        x: x,
                        y: y,
                        width: 0,
                        height: 0,
                        area: 0,
                    };
                    // Flood fill to find connected component
                    const queue = [[x, y]];
                    visited.add(idx);
                    let minX = x, maxX = x, minY = y, maxY = y;
                    let area = 1;
                    while (queue.length > 0) {
                        const [cx, cy] = queue.shift();
                        // Check neighbors
                        for (const [dx, dy] of [
                            [0, 1],
                            [1, 0],
                            [0, -1],
                            [-1, 0],
                        ]) {
                            const nx = cx + dx;
                            const ny = cy + dy;
                            const nidx = ny * width + nx;
                            if (nx >= 0 &&
                                nx < width &&
                                ny >= 0 &&
                                ny < height &&
                                pixels[nidx] > 128 &&
                                !visited.has(nidx)) {
                                queue.push([nx, ny]);
                                visited.add(nidx);
                                area++;
                                minX = Math.min(minX, nx);
                                maxX = Math.max(maxX, nx);
                                minY = Math.min(minY, ny);
                                maxY = Math.max(maxY, ny);
                            }
                        }
                    }
                    region.x = minX;
                    region.y = minY;
                    region.width = maxX - minX + 1;
                    region.height = maxY - minY + 1;
                    region.area = area;
                    // Filter small regions
                    if (area > 100) {
                        regions.push(region);
                    }
                }
            }
        }
        return regions;
    }
    catch (error) {
        console.error('Text region detection failed:', error);
        return [];
    }
}
function findMainRegion(regions) {
    // Sort regions by area in descending order
    regions.sort((a, b) => b.area - a.area);
    // Return the largest region with some padding
    const main = regions[0];
    const padding = 20;
    return {
        x: Math.max(0, main.x - padding),
        y: Math.max(0, main.y - padding),
        width: main.width + padding * 2,
        height: main.height + padding * 2,
        area: main.area,
    };
}
function findPeaks(profile) {
    const peaks = [];
    const minPeakDistance = 10;
    const threshold = Math.max(...profile) * 0.5;
    for (let i = 1; i < profile.length - 1; i++) {
        if (profile[i] > threshold && profile[i] > profile[i - 1] && profile[i] > profile[i + 1]) {
            // Check if this peak is far enough from previous peaks
            if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
                peaks.push(i);
            }
        }
    }
    return peaks;
}
//# sourceMappingURL=image-processor.js.map