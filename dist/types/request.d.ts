export interface FileRequest extends AuthenticatedRequest {
    file?: Express.Multer.File;
}
