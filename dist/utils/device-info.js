import { DeviceType } from '../types/security.js';
import { UAParser } from 'ua-parser-js';
export function getDeviceInfo(userAgent, ip) {
    const parser = new UAParser(userAgent);
    const device = parser.getDevice();
    const os = parser.getOS();
    const browser = parser.getBrowser();
    let type = 'unknown';
    if (device.type) {
        switch (device.type.toLowerCase()) {
            case 'mobile':
            case 'phone':
                type = 'mobile';
                break;
            case 'tablet':
                type = 'tablet';
                break;
            case 'desktop':
            case 'computer':
                type = 'desktop';
                break;
        }
    }
    return {
        type,
        name: device.model || device.vendor || browser.name || 'Unknown Device',
        os: os.name ? `${os.name} ${os.version || ''}`.trim() : 'Unknown OS',
        browser: browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'Unknown Browser',
        ip,
        userAgent,
    };
}
//# sourceMappingURL=device-info.js.map