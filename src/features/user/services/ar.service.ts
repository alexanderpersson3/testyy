import type { Recipe } from '../types/express.js';
import type { ObjectId, UpdateFilter } from '../types/express.js';
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import { ARSession, ARMeasurement, ARCalibration, ARSettings, ImageAnalysisResult, AROverlay, DetectedObject, MeasurementType, ReferenceObject, MeasurementSystem,  } from '../types/ar.js';;
import { StorageService } from '../storage.service.js';;
import type { RecipeService } from '../types/express.js';
import * as tf from '@tensorflow/tfjs-node';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { createCanvas, loadImage } from 'canvas';;

interface MobileNetPrediction {
  className: string;
  probability: number;
}

interface CocoSsdPrediction {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

export class ARService {
  private static instance: ARService;
  private storageService: StorageService;
  private recipeService: RecipeService;
  private objectDetectionModel: cocoSsd.ObjectDetection | null = null;
  private imageClassificationModel: mobilenet.MobileNet | null = null;
  private poseDetectionModel: poseDetection.PoseDetector | null = null;

  private constructor() {
    this.storageService = StorageService.getInstance();
    this.recipeService = RecipeService.getInstance();
    this.initializeModels();
  }

  static getInstance(): ARService {
    if (!ARService.instance) {
      ARService.instance = new ARService();
    }
    return ARService.instance;
  }

  /**
   * Initialize ML models
   */
  private async initializeModels(): Promise<void> {
    try {
      // Load object detection model
      this.objectDetectionModel = await cocoSsd.load();

      // Load image classification model
      this.imageClassificationModel = await mobilenet.load();

      // Load pose detection model
      this.poseDetectionModel = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER }
      );

      logger.info('AR models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AR models:', error);
      throw error;
    }
  }

  /**
   * Start AR session
   */
  async startSession(userId: ObjectId, recipeId?: ObjectId): Promise<ARSession> {
    const db = await connectToDatabase();

    const session: ARSession = {
      userId,
      recipeId,
      startTime: new Date(),
      measurements: [],
      images: [],
      status: 'active',
    };

    const result = await db.collection<ARSession>('ar_sessions').insertOne(session);
    return {
      ...session,
      _id: result.insertedId,
    };
  }

  /**
   * End AR session
   */
  async endSession(sessionId: ObjectId): Promise<void> {
    const db = await connectToDatabase();

    const update: UpdateFilter<ARSession> = {
      $set: {
        endTime: new Date(),
        status: 'completed' as const,
      },
    };

    await db.collection<ARSession>('ar_sessions').updateOne(
      { _id: sessionId },
      update
    );
  }

  /**
   * Analyze image
   */
  async analyzeImage(
    imageBuffer: Buffer,
    options: {
      detectObjects?: boolean;
      detectText?: boolean;
      detectIngredients?: boolean;
      detectMeasurements?: boolean;
    } = {}
  ): Promise<ImageAnalysisResult> {
    try {
      const image = await loadImage(imageBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      // Convert canvas to tensor using node-canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const tensor = tf.tensor3d(new Uint8Array(imageData.data), [canvas.height, canvas.width, 3]);

      const result: ImageAnalysisResult = {
        objects: [],
        labels: [],
        metadata: {
          width: image.width,
          height: image.height,
          format: 'jpeg',
        },
      };

      // Detect objects
      if (options.detectObjects && this.objectDetectionModel) {
        const predictions = await this.objectDetectionModel.detect(tensor);
        result.objects = predictions.map((pred: CocoSsdPrediction) => ({
          label: pred.class,
          confidence: pred.score,
          boundingBox: {
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3],
          },
        }));
      }

      // Classify image
      if (this.imageClassificationModel) {
        const predictions = await this.imageClassificationModel.classify(tensor);
        result.labels = predictions.map((pred: MobileNetPrediction) => ({
          name: pred.className,
          confidence: pred.probability,
        }));
      }

      // Detect ingredients (using object detection and classification)
      if (options.detectIngredients && result.objects.length > 0) {
        result.ingredients = result.objects
          .filter(obj => this.isIngredient(obj.label))
          .map(obj => ({
            name: obj.label,
            confidence: obj.confidence,
          }));
      }

      // Detect measurements (using object detection and reference objects)
      if (options.detectMeasurements && result.objects.length > 0) {
        result.measurements = await this.detectMeasurements(result.objects);
      }

      tensor.dispose();
      return result;
    } catch (error) {
      logger.error('Failed to analyze image:', error);
      throw error;
    }
  }

  /**
   * Add image to session
   */
  async addImage(sessionId: ObjectId, imageBuffer: Buffer, overlays: AROverlay[]): Promise<void> {
    const db = await connectToDatabase();

    // Upload image
    const key = `ar-sessions/${sessionId}/${Date.now()}.jpg`;
    await this.storageService.uploadFile(key, imageBuffer, {
      contentType: 'image/jpeg',
    });

    const url = await this.storageService.getSignedUrl(key);

    // Analyze image
    const analysis = await this.analyzeImage(imageBuffer, {
      detectObjects: true,
      detectIngredients: true,
      detectMeasurements: true,
    });

    // Add to session
    const update: UpdateFilter<ARSession> = {
      $push: {
        images: {
          url,
          analysis,
          overlays,
          timestamp: new Date(),
        },
      },
    };

    await db.collection<ARSession>('ar_sessions').updateOne(
      { _id: sessionId },
      update
    );
  }

  /**
   * Add measurement
   */
  async addMeasurement(
    measurement: Omit<ARMeasurement, '_id' | 'createdAt'>
  ): Promise<ARMeasurement> {
    const db = await connectToDatabase();

    const now = new Date();
    const newMeasurement: ARMeasurement = {
      ...measurement,
      createdAt: now,
    };

    const result = await db.collection<ARMeasurement>('ar_measurements').insertOne(newMeasurement);
    return {
      ...newMeasurement,
      _id: result.insertedId,
    };
  }

  /**
   * Calibrate camera
   */
  async calibrateCamera(
    userId: ObjectId,
    deviceId: string,
    referenceImage: Buffer
  ): Promise<ARCalibration> {
    const db = await connectToDatabase();

    // Analyze reference image
    const analysis = await this.analyzeImage(referenceImage, {
      detectObjects: true,
    });

    // Find reference object in image
    const referenceObject = this.findReferenceObject(analysis.objects);
    if (!referenceObject) {
      throw new Error('No reference object found in image');
    }

    // Calculate camera parameters
    const cameraParameters = await this.calculateCameraParameters(
      referenceObject,
      analysis.metadata
    );

    // Save calibration
    const calibration: ARCalibration = {
      userId,
      deviceId,
      cameraParameters,
      referenceObject: {
        type: this.getReferenceObjectType(referenceObject.label),
        dimensions: this.getReferenceObjectDimensions(referenceObject.label),
        imageUrl: await this.saveReferenceImage(referenceImage, userId, deviceId),
      },
      accuracy: this.calculateCalibrationAccuracy(referenceObject, cameraParameters),
      lastCalibrated: new Date(),
    };

    const result = await db.collection<ARCalibration>('ar_calibrations').insertOne(calibration);
    return {
      ...calibration,
      _id: result.insertedId,
    };
  }

  /**
   * Get AR settings
   */
  async getSettings(userId: ObjectId): Promise<ARSettings | null> {
    const db = await connectToDatabase();
    return db.collection<ARSettings>('ar_settings').findOne({ userId });
  }

  /**
   * Update AR settings
   */
  async updateSettings(
    userId: ObjectId,
    settings: Partial<ARSettings['preferences']>
  ): Promise<ARSettings> {
    const db = await connectToDatabase();

    const now = new Date();
    const existingSettings = await db.collection<ARSettings>('ar_settings').findOne({ userId });

    // Create default preferences if none exist
    const defaultPreferences: ARSettings['preferences'] = {
      measurementSystem: 'metric',
      overlayOpacity: 0.8,
      showMeasurements: true,
      showIngredients: true,
      showInstructions: true,
      showWarnings: true,
      autoCalibrate: false,
      saveImages: true,
    };

    const updatedPreferences = {
      ...defaultPreferences,
      ...existingSettings?.preferences,
      ...settings,
    };

    const update: UpdateFilter<ARSettings> = {
      $set: {
        preferences: updatedPreferences,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
      },
    };

    await db.collection<ARSettings>('ar_settings').updateOne(
      { userId },
      update,
      { upsert: true }
    );

    // Fetch the updated document
    const updatedSettings = await db.collection<ARSettings>('ar_settings').findOne({ userId });
    if (!updatedSettings) {
      throw new Error('Failed to update AR settings');
    }

    return updatedSettings;
  }

  /**
   * Helper: Check if object is an ingredient
   */
  private isIngredient(label: string): boolean {
    const ingredientCategories = [
      'fruit',
      'vegetable',
      'meat',
      'fish',
      'dairy',
      'grain',
      'spice',
      'herb',
      'condiment',
    ];
    return ingredientCategories.some(category => label.toLowerCase().includes(category));
  }

  /**
   * Helper: Detect measurements from objects
   */
  private async detectMeasurements(
    objects: DetectedObject[]
  ): Promise<ImageAnalysisResult['measurements']> {
    const measurements = [];
    const referenceObject = this.findReferenceObject(objects);

    if (!referenceObject) {
      return [];
    }

    const refDimensions = this.getReferenceObjectDimensions(referenceObject.label);
    const pixelsPerUnit = referenceObject.boundingBox.width / refDimensions.width;

    for (const obj of objects) {
      if (obj === referenceObject) continue;

      // Calculate measurements based on reference object
      const width = obj.boundingBox.width / pixelsPerUnit;
      const height = obj.boundingBox.height / pixelsPerUnit;

      measurements.push({
        type: 'length' as MeasurementType,
        value: Math.max(width, height),
        unit: refDimensions.unit,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox,
      });
    }

    return measurements;
  }

  /**
   * Helper: Find reference object in detected objects
   */
  private findReferenceObject(objects: DetectedObject[]): DetectedObject | null {
    const referenceObjects = ['credit card', 'coin', 'ruler'];
    return (
      objects.find(obj => referenceObjects.some(ref => obj.label.toLowerCase().includes(ref))) ||
      null
    );
  }

  /**
   * Helper: Get reference object type
   */
  private getReferenceObjectType(label: string): ARCalibration['referenceObject']['type'] {
    if (label.toLowerCase().includes('card')) return 'card';
    if (label.toLowerCase().includes('coin')) return 'coin';
    if (label.toLowerCase().includes('ruler')) return 'ruler';
    throw new Error('Invalid reference object type');
  }

  /**
   * Helper: Get reference object dimensions
   */
  private getReferenceObjectDimensions(label: string): {
    width: number;
    height?: number;
    unit: string;
  } {
    // Standard dimensions for common reference objects
    if (label.toLowerCase().includes('credit card')) {
      return { width: 85.6, height: 53.98, unit: 'mm' };
    }
    if (label.toLowerCase().includes('quarter')) {
      return { width: 24.26, unit: 'mm' };
    }
    if (label.toLowerCase().includes('ruler')) {
      return { width: 300, unit: 'mm' };
    }
    throw new Error('Unknown reference object dimensions');
  }

  /**
   * Helper: Calculate camera parameters
   */
  private async calculateCameraParameters(
    referenceObject: DetectedObject,
    metadata: ImageAnalysisResult['metadata']
  ): Promise<ARCalibration['cameraParameters']> {
    // Simplified camera calibration
    // In a real implementation, this would use more sophisticated computer vision algorithms
    const focalLength = metadata.width / 2;
    return {
      focalLength,
      principalPoint: {
        x: metadata.width / 2,
        y: metadata.height / 2,
      },
      distortionCoefficients: [0, 0, 0, 0, 0], // Simplified, no distortion
    };
  }

  /**
   * Helper: Calculate calibration accuracy
   */
  private calculateCalibrationAccuracy(
    referenceObject: DetectedObject,
    cameraParameters: ARCalibration['cameraParameters']
  ): number {
    // Simplified accuracy calculation
    // In a real implementation, this would use more sophisticated metrics
    return referenceObject.confidence;
  }

  /**
   * Helper: Save reference image
   */
  private async saveReferenceImage(
    imageBuffer: Buffer,
    userId: ObjectId,
    deviceId: string
  ): Promise<string> {
    const key = `ar-calibration/${userId}/${deviceId}/${Date.now()}.jpg`;
    await this.storageService.uploadFile(key, imageBuffer, {
      contentType: 'image/jpeg',
    });
    return this.storageService.getSignedUrl(key);
  }
}
