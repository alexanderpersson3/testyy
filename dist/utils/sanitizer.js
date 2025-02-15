import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
const window = new JSDOM('').window;
const purify = DOMPurify(window);
const ALLOWED_TAGS = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'b',
    'i',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'img',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'id', 'name', 'width', 'height'];
export function sanitizeHtml(html) {
    return purify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        WHOLE_DOCUMENT: false,
        SANITIZE_DOM: true,
    });
}
export function stripHtml(html) {
    return purify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        WHOLE_DOCUMENT: false,
        SANITIZE_DOM: true,
    });
}
export function sanitizeUrl(url) {
    // Only allow http:// and https:// URLs
    if (!/^https?:\/\//i.test(url)) {
        return '';
    }
    // Remove any script tags or dangerous protocols
    url = url
        .replace(/<script.*?>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '');
    return url;
}
export function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-z0-9.-]/gi, '_') // Replace invalid chars with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^[.-]+|[.-]+$/g, '') // Remove leading/trailing dots and dashes
        .toLowerCase();
}
//# sourceMappingURL=sanitizer.js.map