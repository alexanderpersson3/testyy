import { DeviceType } from '../types/security.js';
export interface DeviceInfo {
    type: DeviceType;
    name: string;
    os: string;
    browser: string;
    ip: string;
    userAgent: string;
}
export declare function getDeviceInfo(userAgent: string, ip: string): DeviceInfo;
