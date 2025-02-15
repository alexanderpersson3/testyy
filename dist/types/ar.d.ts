import { ObjectId } from 'mongodb';
export type MeasurementType = 'length' | 'volume' | 'weight' | 'temperature';
export type MeasurementSystem = 'metric' | 'imperial';
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface DetectedObject {
    label: string;
    confidence: number;
    boundingBox: BoundingBox;
}
export interface Label {
    name: string;
    confidence: number;
}
export interface Ingredient {
    name: string;
    confidence: number;
}
export interface Measurement {
    type: MeasurementType;
    value: number;
    unit: string;
    confidence: number;
    boundingBox: BoundingBox;
}
export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
}
export interface ImageAnalysisResult {
    objects: DetectedObject[];
    labels: Label[];
    ingredients?: Ingredient[];
    measurements?: Measurement[];
    metadata: ImageMetadata;
}
export interface AROverlay {
    type: 'text' | 'measurement' | 'ingredient' | 'instruction';
    content: string;
    position: {
        x: number;
        y: number;
    };
    size?: {
        width: number;
        height: number;
    };
    style?: {
        color?: string;
        opacity?: number;
        fontSize?: number;
    };
}
export interface ARSession {
    _id?: ObjectId;
    userId: ObjectId;
    recipeId?: ObjectId;
    startTime: Date;
    endTime?: Date;
    measurements: Measurement[];
    images: {
        url: string;
        analysis: ImageAnalysisResult;
        overlays: AROverlay[];
        timestamp: Date;
    }[];
    status: 'active' | 'completed' | 'error';
}
export interface ARMeasurement {
    _id?: ObjectId;
    userId: ObjectId;
    recipeId?: ObjectId;
    sessionId: ObjectId;
    type: MeasurementType;
    value: number;
    unit: string;
    confidence: number;
    boundingBox: BoundingBox;
    createdAt: Date;
}
export interface CameraParameters {
    focalLength: number;
    principalPoint: {
        x: number;
        y: number;
    };
    distortionCoefficients: number[];
}
export interface ReferenceObject {
    type: 'card' | 'coin' | 'ruler';
    dimensions: {
        width: number;
        height?: number;
        unit: string;
    };
    imageUrl: string;
}
export interface ARCalibration {
    _id?: ObjectId;
    userId: ObjectId;
    deviceId: string;
    cameraParameters: CameraParameters;
    referenceObject: ReferenceObject;
    accuracy: number;
    lastCalibrated: Date;
}
export interface ARSettings {
    _id?: ObjectId;
    userId: ObjectId;
    preferences: {
        measurementSystem: MeasurementSystem;
        overlayOpacity: number;
        showMeasurements: boolean;
        showIngredients: boolean;
        showInstructions: boolean;
        showWarnings: boolean;
        autoCalibrate: boolean;
        saveImages: boolean;
    };
    updatedAt: Date;
}
