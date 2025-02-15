import type { ObjectId } from '../types/index.js';
import { ARSession, ARMeasurement, ARCalibration, ARSettings, ImageAnalysisResult, AROverlay } from '../types/ar.js';
export declare class ARService {
    private static instance;
    private storageService;
    private recipeService;
    private objectDetectionModel;
    private imageClassificationModel;
    private poseDetectionModel;
    private constructor();
    static getInstance(): ARService;
    /**
     * Initialize ML models
     */
    private initializeModels;
    /**
     * Start AR session
     */
    startSession(userId: ObjectId, recipeId?: ObjectId): Promise<ARSession>;
    /**
     * End AR session
     */
    endSession(sessionId: ObjectId): Promise<void>;
    /**
     * Analyze image
     */
    analyzeImage(imageBuffer: Buffer, options?: {
        detectObjects?: boolean;
        detectText?: boolean;
        detectIngredients?: boolean;
        detectMeasurements?: boolean;
    }): Promise<ImageAnalysisResult>;
    /**
     * Add image to session
     */
    addImage(sessionId: ObjectId, imageBuffer: Buffer, overlays: AROverlay[]): Promise<void>;
    /**
     * Add measurement
     */
    addMeasurement(measurement: Omit<ARMeasurement, '_id' | 'createdAt'>): Promise<ARMeasurement>;
    /**
     * Calibrate camera
     */
    calibrateCamera(userId: ObjectId, deviceId: string, referenceImage: Buffer): Promise<ARCalibration>;
    /**
     * Get AR settings
     */
    getSettings(userId: ObjectId): Promise<ARSettings | null>;
    /**
     * Update AR settings
     */
    updateSettings(userId: ObjectId, settings: Partial<ARSettings['preferences']>): Promise<ARSettings>;
    /**
     * Helper: Check if object is an ingredient
     */
    private isIngredient;
    /**
     * Helper: Detect measurements from objects
     */
    private detectMeasurements;
    /**
     * Helper: Find reference object in detected objects
     */
    private findReferenceObject;
    /**
     * Helper: Get reference object type
     */
    private getReferenceObjectType;
    /**
     * Helper: Get reference object dimensions
     */
    private getReferenceObjectDimensions;
    /**
     * Helper: Calculate camera parameters
     */
    private calculateCameraParameters;
    /**
     * Helper: Calculate calibration accuracy
     */
    private calculateCalibrationAccuracy;
    /**
     * Helper: Save reference image
     */
    private saveReferenceImage;
}
