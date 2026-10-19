/**
 * emailService.js
 *
 * Sends real emails to the plant owner/supervisor via Gmail SMTP, using
 * an App Password (not your regular Gmail password — Google requires an
 * App Password for SMTP access from third-party apps).
 *
 * Setup (see TORUN.md for full steps):
 *   1. Enable 2-Step Verification on the sending Gmail account.
 *   2. Generate an App Password at https://myaccount.google.com/apppasswords
 *   3. Add to your Backend's config.env (or environment):
 *        GMAIL_USER=your-sending-address@gmail.com
 *        GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char app password)
 *        OWNER_EMAIL=owner@example.com            (who receives alerts)
 *
 * ⚠️ NOT independently tested against a live send — my sandbox has no
 * network access to smtp.gmail.com at all. The nodemailer usage matches
 * their official Gmail SMTP documentation exactly, and the "not
 * configured" guard path was verified. You are the first to actually
 * send a real email with this. If it errors, paste the exact error and
 * it can be fixed from the real response.
 */
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const OWNER_EMAIL = process.env.OWNER_EMAIL;

// Severity levels that trigger an actual email (per your instruction:
// MEDIUM and above). Anything below this is logged/simulated only.
const EMAIL_TRIGGER_SEVERITIES = new Set(['MEDIUM', 'HIGH', 'moderate', 'severe']);

function isConfigured() {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD && OWNER_EMAIL);
}

function shouldTriggerEmail(severity) {
  return EMAIL_TRIGGER_SEVERITIES.has(severity);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Builds a styled HTML email body. Uses inline styles throughout (not a
 * <style> block) because most email clients — Gmail included — strip or
 * ignore <style> tags in the <head>.
 */
function buildHtmlBody({ grade, severity, composition, recommendedAdditions, batchId, isUrgent, costDetails }) {
  const severityColors = {
    HIGH: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', accent: '#ef4444' },
    severe: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', accent: '#ef4444' },
    MEDIUM: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d', accent: '#f59e0b' },
    moderate: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d', accent: '#f59e0b' },
  };
  const sc = severityColors[severity] || { bg: '#f0fdf6', text: '#0e7e46', border: '#7eedb4', accent: '#15c26b' };

  const compositionCards = Object.entries(composition || {})
    .map(
      ([el, val]) => `
      <td style="padding:4px;" width="16.66%">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="background-color:#f8fafb;border:1px solid #e5eaef;border-radius:10px;padding:14px 4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;color:#6b7f94;letter-spacing:0.5px;">${el}</div>
            <div style="font-family:'Courier New',monospace;font-size:17px;font-weight:700;color:#1a2129;margin-top:4px;">${val}%</div>
          </td></tr>
        </table>
      </td>`
    )
    .join('');

  const hasAdditions = recommendedAdditions && Object.keys(recommendedAdditions).length > 0;
  const additionsCards = hasAdditions
    ? Object.entries(recommendedAdditions)
        .map(
          ([el, val]) => `
      <td style="padding:4px;" width="33.33%">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="background-color:#f0fdf6;border:1px solid #b9f8d6;border-radius:10px;padding:14px 4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;color:#0e7e46;letter-spacing:0.5px;">${el}</div>
            <div style="font-family:'Courier New',monospace;font-size:17px;font-weight:700;color:#0e7e46;margin-top:4px;">+${val}%</div>
          </td></tr>
        </table>
      </td>`
        )
        .join('')
    : `<td style="padding:4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background-color:#f0fdf6;border:1px dashed #b9f8d6;border-radius:10px;padding:18px;"><span style="font-family:Arial,sans-serif;font-size:13px;color:#0e7e46;">&#10003; No correction needed</span></td></tr></table></td>`;

  function chunkIntoRows(cellsHtml, perRow) {
    const cells = cellsHtml.match(/<td[\s\S]*?<\/td>(?=\s*(<td|$))/g) || [];
    let rows = '';
    for (let i = 0; i < cells.length; i += perRow) {
      rows += `<tr>${cells.slice(i, i + perRow).join('')}</tr>`;
    }
    return rows;
  }

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,194,107,0.14);">

          <tr>
            <td style="background:linear-gradient(135deg,#15c26b 0%,#0fa055 60%,#0e7e46 100%);padding:32px 32px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display:inline-block;background-color:rgba(255,255,255,0.2);width:36px;height:36px;border-radius:9px;text-align:center;line-height:36px;font-size:18px;">&#9881;&#65039;</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;">
                    <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.3px;">MeltMetrics</span>
                    <div style="color:#dcfceb;font-size:13px;margin-top:3px;font-weight:500;">Automated Deviation Alert</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top">
                    <span style="display:inline-block;background-color:${sc.bg};border:1.5px solid ${sc.border};border-radius:24px;padding:7px 18px;">
                      <span style="color:${sc.text};font-size:12px;font-weight:800;letter-spacing:0.6px;">&#9679; ${severity.toUpperCase()} SEVERITY</span>
                    </span>
                  </td>
                  ${batchId ? `<td align="right" valign="top"><span style="font-size:13px;color:#9eafc0;font-weight:600;">Batch ${batchId}</span></td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 0 32px;">
              <span style="font-size:26px;font-weight:800;color:#1a2129;letter-spacing:-0.3px;">${grade}</span>
            </td>
          </tr>

          ${isUrgent ? `
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;">
                <tr><td style="padding:12px 16px;">
                  <span style="color:#b91c1c;font-size:13.5px;font-weight:700;">&#9888; Immediate review recommended before proceeding with this batch</span>
                </td></tr>
              </table>
            </td>
          </tr>` : ''}

          <tr><td style="padding:24px 32px 0 32px;"><div style="height:1px;background-color:#eef2f5;"></div></td></tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">
              <p style="margin:0 0 12px 0;font-size:12px;font-weight:800;color:#4f5f73;text-transform:uppercase;letter-spacing:0.8px;">Current Composition</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${chunkIntoRows(compositionCards, 3)}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">
              <p style="margin:0 0 12px 0;font-size:12px;font-weight:800;color:#0e7e46;text-transform:uppercase;letter-spacing:0.8px;">Recommended Correction</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${hasAdditions ? chunkIntoRows(additionsCards, 3) : `<tr>${additionsCards}</tr>`}
              </table>
            </td>
          </tr>

          ${costDetails ? `
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <p style="margin:0 0 12px 0;font-size:12px;font-weight:800;color:#4f5f73;text-transform:uppercase;letter-spacing:0.8px;">Cost &amp; Impact</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${costDetails.correctionCost != null ? `
                  <td style="padding:4px;" width="50%">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="background-color:#f8fafb;border:1px solid #e5eaef;border-radius:10px;padding:14px 16px;">
                        <div style="font-size:11px;font-weight:800;color:#6b7f94;letter-spacing:0.5px;">CORRECTION COST</div>
                        <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#1a2129;margin-top:4px;">&#8377;${Number(costDetails.correctionCost).toLocaleString('en-IN')}</div>
                      </td></tr>
                    </table>
                  </td>` : ''}
                  ${costDetails.carbonKg != null ? `
                  <td style="padding:4px;" width="50%">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="background-color:#f8fafb;border:1px solid #e5eaef;border-radius:10px;padding:14px 16px;">
                        <div style="font-size:11px;font-weight:800;color:#6b7f94;letter-spacing:0.5px;">CARBON FOOTPRINT</div>
                        <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#1a2129;margin-top:4px;">${costDetails.carbonKg} kg CO2e</div>
                      </td></tr>
                    </table>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>` : ''}

          ${costDetails && costDetails.savingsPerTon != null ? `
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf6;border:1px solid #b9f8d6;border-radius:10px;">
                <tr><td style="padding:16px 18px;">
                  <div style="font-size:11px;font-weight:800;color:#0e7e46;letter-spacing:0.5px;">SAVINGS BY CORRECTING NOW</div>
                  <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:800;color:#0e7e46;margin-top:6px;">
                    &#8377;${Number(costDetails.savingsPerTon).toLocaleString('en-IN')}/ton
                    ${costDetails.savingsPercent != null ? `<span style="font-size:14px;font-weight:600;color:#3fa878;"> &nbsp;(${costDetails.savingsPercent}% of selling price)</span>` : ''}
                  </div>
                  ${costDetails.downgradeGrade ? `<div style="font-size:12.5px;color:#4f5f73;margin-top:8px;">If left uncorrected, this batch would downgrade to <strong>${costDetails.downgradeGrade}</strong>${costDetails.lossPerTon != null ? `, losing &#8377;${Number(costDetails.lossPerTon).toLocaleString('en-IN')}/ton in value.` : '.'}</div>` : ''}
                </td></tr>
              </table>
            </td>
          </tr>` : ''}

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafb;border-radius:10px;">
                <tr><td style="padding:16px 18px;">
                  <span style="font-size:13px;color:#4f5f73;line-height:1.5;">
                    ${isUrgent
                      ? 'This batch requires operator sign-off before tapping. Review the full analysis in MeltMetrics.'
                      : 'Flagged for routine review &mdash; no immediate action blocking this batch.'}
                  </span>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 28px 32px;">
              <div style="height:1px;background-color:#eef2f5;margin-bottom:18px;"></div>
              <span style="color:#9eafc0;font-size:11.5px;">Sent automatically by <strong style="color:#6b7f94;">MeltMetrics</strong> &mdash; AI-powered foundry composition monitoring.</span>
            </td>
          </tr>

        </table>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td style="padding-top:18px;" align="center">
          <span style="font-size:11px;color:#b3c0cc;">This is an automated alert. Do not reply to this email.</span>
        </td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a real deviation alert email with the full composition, plus
 * optional cost/carbon/savings details.
 * @param {Object} params
 * @param {string} params.grade
 * @param {string} params.severity
 * @param {Object} params.composition - { Fe, C, Si, Mn, P, S, ... }
 * @param {Object} [params.recommendedAdditions] - alloy correction, if any
 * @param {string} [params.batchId]
 * @param {Object} [params.costDetails] - { correctionCost, carbonKg, savingsPerTon, savingsPercent, downgradeGrade, lossPerTon }
 * @returns {Promise<{sent: boolean, reason?: string, messageId?: string}>}
 */
async function sendDeviationAlertEmail({ grade, severity, composition, recommendedAdditions, batchId, costDetails }) {
  if (!isConfigured()) {
    return {
      sent: false,
      reason: 'Email not configured — set GMAIL_USER, GMAIL_APP_PASSWORD, and OWNER_EMAIL in config.env',
    };
  }

  const isUrgent = ['HIGH', 'severe'].includes(severity);
  const subject = isUrgent
    ? `🔴 URGENT: Severe deviation detected — ${grade}${batchId ? ` (Batch ${batchId})` : ''}`
    : `🟡 Deviation flagged — ${grade}${batchId ? ` (Batch ${batchId})` : ''}`;

  // Plain-text fallback for email clients that don't render HTML.
  const compositionLines = Object.entries(composition || {})
    .map(([el, val]) => `  ${el}: ${val}%`)
    .join('\n');
  const additionsLines = recommendedAdditions && Object.keys(recommendedAdditions).length > 0
    ? Object.entries(recommendedAdditions).map(([el, val]) => `  ${el}: +${val}%`).join('\n')
    : '  (none needed)';
  const costLines = costDetails
    ? [
        costDetails.correctionCost != null ? `Correction cost: ₹${Number(costDetails.correctionCost).toLocaleString('en-IN')}` : null,
        costDetails.carbonKg != null ? `Carbon footprint: ${costDetails.carbonKg} kg CO2e` : null,
        costDetails.savingsPerTon != null ? `Savings by correcting now: ₹${Number(costDetails.savingsPerTon).toLocaleString('en-IN')}/ton${costDetails.savingsPercent != null ? ` (${costDetails.savingsPercent}% of selling price)` : ''}` : null,
        costDetails.downgradeGrade ? `If uncorrected, downgrades to ${costDetails.downgradeGrade}${costDetails.lossPerTon != null ? `, losing ₹${Number(costDetails.lossPerTon).toLocaleString('en-IN')}/ton` : ''}` : null,
      ].filter(Boolean).join('\n')
    : '';
  const textBody = `
MeltMetrics Deviation Alert

Grade: ${grade}
${batchId ? `Batch: ${batchId}\n` : ''}Severity: ${severity}

Current Composition:
${compositionLines}

Recommended Alloy Additions:
${additionsLines}
${costLines ? `\nCost & Impact:\n${costLines}\n` : ''}
${isUrgent
    ? 'Immediate review recommended before proceeding with this batch.'
    : 'Review when convenient.'}

— Sent automatically by MeltMetrics
`.trim();

  const htmlBody = buildHtmlBody({ grade, severity, composition, recommendedAdditions, batchId, isUrgent, costDetails });

  try {
    const info = await getTransporter().sendMail({
      from: `"MeltMetrics Alerts" <${GMAIL_USER}>`,
      to: OWNER_EMAIL,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  isConfigured,
  shouldTriggerEmail,
  sendDeviationAlertEmail,
};