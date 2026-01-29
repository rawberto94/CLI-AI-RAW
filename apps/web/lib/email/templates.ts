/**
 * Email Templates
 * 
 * Reusable HTML templates for various notification types
 */

export const emailTemplates = {
  /**
   * Contract expiration alert
   */
  contractExpiring: (data: {
    contractTitle: string;
    expirationDate: string;
    daysUntilExpiration: number;
    contractId: string;
    contractUrl: string;
  }) => ({
    subject: `⚠️ Contract Expiring Soon: ${data.contractTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert { background: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⚠️ Contract Expiration Alert</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <div class="alert">
                <strong>⏰ ${data.daysUntilExpiration} days remaining</strong>
              </div>
              
              <p>The following contract is approaching its expiration date and requires your attention:</p>
              
              <h2 style="color: #0066CC;">${data.contractTitle}</h2>
              
              <p><strong>Expiration Date:</strong> ${data.expirationDate}</p>
              
              <p>Please review this contract and take appropriate action:</p>
              <ul>
                <li>Prepare for renewal negotiations</li>
                <li>Update stakeholders</li>
                <li>Review terms and obligations</li>
                <li>Plan transition if not renewing</li>
              </ul>
              
              <a href="${data.contractUrl}" class="button">View Contract Details</a>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This is an automated notification from ConTigo Contract Intelligence Platform.
              </p>
            </div>
            <div class="footer">
              <p>ConTigo - AI-Powered Contract Intelligence</p>
              <p>© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  /**
   * Approval request notification
   */
  approvalRequest: (data: {
    contractTitle: string;
    requestedBy: string;
    urgency: 'high' | 'medium' | 'low';
    contractUrl: string;
    approvalUrl: string;
  }) => ({
    subject: `📝 Approval Required: ${data.contractTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .urgency-high { background: #FFEBEE; border-left: 4px solid #F44336; padding: 15px; margin: 20px 0; }
            .urgency-medium { background: #FFF3E0; border-left: 4px solid #FF9800; padding: 15px; margin: 20px 0; }
            .urgency-low { background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 10px 10px 0; }
            .button-secondary { background: #6c757d; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📝 Approval Required</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <div class="urgency-${data.urgency}">
                <strong>Priority: ${data.urgency.toUpperCase()}</strong>
              </div>
              
              <p>You have been assigned to review and approve the following contract:</p>
              
              <h2 style="color: #0066CC;">${data.contractTitle}</h2>
              
              <p><strong>Requested by:</strong> ${data.requestedBy}</p>
              
              <p>Please review the contract details and provide your approval or feedback.</p>
              
              <div style="margin: 30px 0;">
                <a href="${data.approvalUrl}" class="button">Approve / Reject</a>
                <a href="${data.contractUrl}" class="button button-secondary">View Contract</a>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This is an automated notification from ConTigo Contract Intelligence Platform.
              </p>
            </div>
            <div class="footer">
              <p>ConTigo - AI-Powered Contract Intelligence</p>
              <p>© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  /**
   * Team invitation
   */
  teamInvitation: (data: {
    invitedBy: string;
    tenantName: string;
    inviteUrl: string;
    expiresIn: string;
  }) => ({
    subject: `🎉 You've been invited to join ${data.tenantName} on ConTigo`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #0066CC; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 32px;">🎉</h1>
              <h1 style="margin: 10px 0 0 0;">You're Invited!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <p><strong>${data.invitedBy}</strong> has invited you to join <strong>${data.tenantName}</strong> on ConTigo Contract Intelligence Platform.</p>
              
              <p>ConTigo helps teams manage contracts efficiently with AI-powered insights, automated workflows, and collaborative tools.</p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                ⏰ This invitation expires in ${data.expiresIn}.
              </p>
              
              <p style="color: #666; font-size: 14px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>ConTigo - AI-Powered Contract Intelligence</p>
              <p>© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  /**
   * Processing complete notification
   */
  processingComplete: (data: {
    contractTitle: string;
    fileName: string;
    processingTime: string;
    contractUrl: string;
    extractedItems: {
      parties: number;
      obligations: number;
      rateCards: number;
    };
  }) => ({
    subject: `✅ Contract Processing Complete: ${data.contractTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .stats { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .stat-item { display: inline-block; width: 30%; text-align: center; margin: 10px 1%; }
            .stat-number { font-size: 32px; font-weight: bold; color: #0066CC; }
            .stat-label { font-size: 14px; color: #666; }
            .button { display: inline-block; background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Processing Complete</h1>
            </div>
            <div class="content">
              <p>Good news!</p>
              
              <p>Your contract <strong>${data.fileName}</strong> has been successfully processed and analyzed.</p>
              
              <h2 style="color: #0066CC;">${data.contractTitle}</h2>
              
              <div class="stats">
                <div class="stat-item">
                  <div class="stat-number">${data.extractedItems.parties}</div>
                  <div class="stat-label">Parties</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${data.extractedItems.obligations}</div>
                  <div class="stat-label">Obligations</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${data.extractedItems.rateCards}</div>
                  <div class="stat-label">Rate Cards</div>
                </div>
              </div>
              
              <p>Processing completed in ${data.processingTime}.</p>
              
              <a href="${data.contractUrl}" class="button">View Contract Details</a>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This is an automated notification from ConTigo Contract Intelligence Platform.
              </p>
            </div>
            <div class="footer">
              <p>ConTigo - AI-Powered Contract Intelligence</p>
              <p>© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  /**
   * Daily digest summary
   */
  dailyDigest: (data: {
    recipientName: string;
    stats: {
      newContracts: number;
      expiringSoon: number;
      pendingApprovals: number;
      processingComplete: number;
    };
    topItems: Array<{
      title: string;
      url: string;
      priority: string;
    }>;
    dashboardUrl: string;
  }) => ({
    subject: `📊 Your Daily Contract Summary - ${new Date().toLocaleDateString()}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .stat-card { background: white; border-radius: 8px; padding: 20px; text-align: center; }
            .stat-number { font-size: 36px; font-weight: bold; color: #0066CC; }
            .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
            .item-list { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .item { padding: 15px; border-bottom: 1px solid #eee; }
            .item:last-child { border-bottom: none; }
            .priority-high { color: #F44336; font-weight: bold; }
            .button { display: inline-block; background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📊 Daily Contract Summary</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div class="content">
              <p>Good morning, ${data.recipientName}!</p>
              
              <p>Here's your contract activity summary for today:</p>
              
              <div class="stat-grid">
                <div class="stat-card">
                  <div class="stat-number">${data.stats.newContracts}</div>
                  <div class="stat-label">New Contracts</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${data.stats.expiringSoon}</div>
                  <div class="stat-label">Expiring Soon</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${data.stats.pendingApprovals}</div>
                  <div class="stat-label">Pending Approvals</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${data.stats.processingComplete}</div>
                  <div class="stat-label">Processing Complete</div>
                </div>
              </div>
              
              ${data.topItems.length > 0 ? `
                <h3 style="color: #0066CC;">⚠️ Items Requiring Attention</h3>
                <div class="item-list">
                  ${data.topItems.map(item => `
                    <div class="item">
                      <div class="priority-${item.priority.toLowerCase()}">${item.priority.toUpperCase()} PRIORITY</div>
                      <strong>${item.title}</strong>
                      <div><a href="${item.url}" style="color: #0066CC;">View Details →</a></div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              <div style="text-align: center;">
                <a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                You're receiving this daily summary because you opted in to email notifications.
                <a href="#" style="color: #0066CC;">Update preferences</a>
              </p>
            </div>
            <div class="footer">
              <p>ConTigo - AI-Powered Contract Intelligence</p>
              <p>© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  /**
   * Contract access granted notification
   */
  contractAccessGranted: (data: {
    recipientName: string;
    contractTitle: string;
    accessLevel: string;
    grantedBy: string;
    expiresAt?: string;
    contractUrl: string;
  }) => ({
    subject: `🔓 You've been granted access to: ${data.contractTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background: #E3F2FD; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
            .access-badge { display: inline-block; background: #4CAF50; color: white; padding: 5px 15px; border-radius: 15px; font-size: 14px; margin: 10px 0; }
            .button { display: inline-block; background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔓 Contract Access Granted</h1>
            </div>
            <div class="content">
              <p>Hello ${data.recipientName},</p>
              
              <div class="info-box">
                <p style="margin: 0;"><strong>${data.grantedBy}</strong> has granted you access to a contract.</p>
              </div>
              
              <h2 style="color: #0066CC;">${data.contractTitle}</h2>
              
              <p><strong>Access Level:</strong> <span class="access-badge">${data.accessLevel.toUpperCase()}</span></p>
              
              ${data.expiresAt ? `<p><strong>Expires:</strong> ${data.expiresAt}</p>` : ''}
              
              <p>You can now:</p>
              <ul>
                ${data.accessLevel === 'view' ? '<li>View contract details and documents</li>' : ''}
                ${data.accessLevel === 'edit' ? '<li>View and edit contract details</li><li>Update contract documents</li>' : ''}
                ${data.accessLevel === 'manage' ? '<li>Full access to view, edit, and manage the contract</li><li>Grant access to other users</li>' : ''}
              </ul>
              
              <a href="${data.contractUrl}" class="button">View Contract</a>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This is an automated notification from ConTigo Contract Intelligence Platform.
              </p>
            </div>
            <div class="footer">
              <p>ConTigo - AI-Powered Contract Intelligence</p>
              <p>© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
};
