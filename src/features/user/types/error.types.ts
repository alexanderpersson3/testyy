
export interface ErrorResponse {
  message: string;
  code: number;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorLog {
  _id?: ObjectId;
  timestamp: Date;
  level: string;
  message: string;
  metadata?: Record<string, any>;
} 