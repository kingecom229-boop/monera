import { Router } from 'express';
import { getSiteSettings, query } from '../config/db.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'monera-core-banking', timestamp: new Date().toISOString() });
});

router.get('/config', async (_req, res, next) => {
  try {
    const settings = await getSiteSettings();
    const statsRes = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'member') AS members_count,
        COALESCE((SELECT SUM(amount)::numeric FROM transactions WHERE status = 'completed'), 0) AS tx_volume
    `);
    const stats = statsRes.rows[0] || { members_count: 0, tx_volume: 0 };

    res.json({
      settings: {
        bankName: settings.bankName,
        tagline: settings.tagline,
        announcementEnabled: settings.announcementEnabled,
        announcementText: settings.announcementText,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        headquarters: settings.headquarters,
        loanAnnualRate: Number(settings.loanAnnualRate),
        maxLoanAmount: Number(settings.maxLoanAmount),
        maxTransferAmount: Number(settings.maxTransferAmount),
        transferFeePercent: Number(settings.transferFeePercent),
        allowRegistration: Boolean(settings.allowRegistration),
        maintenanceMode: Boolean(settings.maintenanceMode),
        customLogoUrl: settings.customLogoUrl || '',
        customFaviconUrl: settings.customFaviconUrl || '',
      },
      metrics: {
        activeClients: 148200 + Number(stats.members_count || 0),
        volumeProcessed: 4280000000 + Number(stats.tx_volume || 0),
        countriesCovered: 38,
        uptime: '99.99%',
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
