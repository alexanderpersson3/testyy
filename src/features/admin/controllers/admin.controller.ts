import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { adminService } from '../services/admin.service.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import type { AuditLogType } from '../types/admin.types.js';

export class AdminController {
  // User Management
  async blockUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = new ObjectId(req.params.id);
      await adminService.blockUser(userId, req.body.reason);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  async unblockUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = new ObjectId(req.params.id);
      await adminService.unblockUser(userId);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      const userId = new ObjectId(req.params.id);
      await adminService.updateUserRole(userId, req.body.role);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.params.id);

    await adminService.deleteUser(userId);
    res.status(204).send();
  }

  async exportUserData(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.params.id);

    const data = await adminService.exportUserData(userId);
    res.json({ success: true, data });
  }

  // Content Moderation
  async removeContent(req: Request, res: Response): Promise<void> {
    try {
      const contentId = new ObjectId(req.params.id);
      await adminService.removeContent(
        contentId,
        req.body.contentType,
        req.body.reason
      );
      res.json({ success: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  async restoreContent(req: Request, res: Response): Promise<void> {
    const contentId = new ObjectId(req.params.id);
    const { contentType } = req.body;

    await adminService.restoreContent(contentId, contentType);
    res.json({ success: true });
  }

  async reviewReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = new ObjectId(req.params.id);
      await adminService.reviewReport(reportId, req.body.action);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  async updateContentGuidelines(req: Request, res: Response): Promise<void> {
    const { guidelines } = req.body;

    await adminService.updateContentGuidelines(guidelines);
    res.json({ success: true });
  }

  // System Configuration
  async updateSettings(req: Request, res: Response): Promise<void> {
    await adminService.updateSettings(req.body);
    res.json({ success: true });
  }

  async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await adminService.getSystemStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async createBackup(req: Request, res: Response): Promise<void> {
    const backup = await adminService.createBackup();
    res.json({ success: true, data: backup });
  }

  async restoreBackup(req: Request, res: Response): Promise<void> {
    const { backupId } = req.params;

    await adminService.restoreBackup(backupId);
    res.json({ success: true });
  }

  // Security Management
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { type, adminId, startDate, endDate, page = '1', limit = '20' } = req.query;
      const logs = await adminService.getAuditLogs({
        type: type as string | string[],
        adminId: adminId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      });
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getActiveTokens(req: Request, res: Response): Promise<void> {
    const tokens = await adminService.getActiveTokens();
    res.json({ success: true, data: tokens });
  }

  async revokeToken(req: Request, res: Response): Promise<void> {
    const { tokenId } = req.params;

    await adminService.revokeToken(tokenId);
    res.json({ success: true });
  }

  async getBlockedIPs(req: Request, res: Response): Promise<void> {
    try {
      const blockedIPs = await adminService.getBlockedIPs();
      res.json({
        success: true,
        data: blockedIPs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async unblockIP(req: Request, res: Response): Promise<void> {
    const { ip } = req.params;

    await adminService.unblockIP(ip);
    res.json({ success: true });
  }
}

// Export singleton instance
export const adminController = new AdminController(); 