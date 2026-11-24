import { AuditLogEntry } from '../types'

/**
 * Audit Logger for Compliance
 */

class AuditLogger {
  private logs: AuditLogEntry[] = []
  private readonly MAX_LOGS = 10000 // Keep last 10K logs in memory

  /**
   * Log an action for audit compliance
   */
  log(
    userId: string,
    username: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: string,
    result: 'success' | 'failure' | 'denied' = 'success'
  ): void {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId,
      username,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: this.getClientIP(),
      result,
    }

    this.logs.push(entry)

    // Keep logs trimmed to MAX_LOGS
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift()
    }

    // In production, this would:
    // 1. Send to SIEM (Security Information and Event Management)
    // 2. Write to encrypted audit database
    console.log('[AUDIT]', entry)
  }

  /**
   * Log user authentication
   */
  logAuthentication(
    userId: string,
    username: string,
    result: 'success' | 'failure',
    details: string = ''
  ): void {
    this.log(userId, username, 'AUTHENTICATION', 'user', userId, details, result)
  }

  /**
   * Log data access
   */
  logDataAccess(
    userId: string,
    username: string,
    resourceType: string,
    resourceId: string,
    details: string = ''
  ): void {
    this.log(userId, username, 'DATA_ACCESS', resourceType, resourceId, details, 'success')
  }

  /**
   * Log data modification
   */
  logDataModification(
    userId: string,
    username: string,
    resourceType: string,
    resourceId: string,
    details: string = ''
  ): void {
    this.log(userId, username, 'DATA_MODIFY', resourceType, resourceId, details, 'success')
  }

  /**
   * Log access denial (security event)
   */
  logAccessDenied(
    userId: string,
    username: string,
    resourceType: string,
    resourceId: string,
    reason: string
  ): void {
    this.log(userId, username, 'ACCESS_DENIED', resourceType, resourceId, reason, 'denied')
  }

  /**
   * Log system configuration change
   */
  logConfigChange(userId: string, username: string, configItem: string, details: string): void {
    this.log(userId, username, 'CONFIG_CHANGE', 'system_config', configItem, details, 'success')
  }

  /**
   * Log export/download (data exfiltration monitoring)
   */
  logExport(
    userId: string,
    username: string,
    resourceType: string,
    resourceId: string,
    exportFormat: string
  ): void {
    this.log(
      userId,
      username,
      'DATA_EXPORT',
      resourceType,
      resourceId,
      `Exported as ${exportFormat}`,
      'success'
    )
  }

  /**
   * Get recent audit logs
   */
  getRecentLogs(count: number = 100): AuditLogEntry[] {
    return this.logs.slice(-count).reverse()
  }

  /**
   * Get logs by user
   */
  getLogsByUser(userId: string, count: number = 100): AuditLogEntry[] {
    return this.logs
      .filter(log => log.userId === userId)
      .slice(-count)
      .reverse()
  }

  /**
   * Get logs by time range
   */
  getLogsByTimeRange(startTime: Date, endTime: Date): AuditLogEntry[] {
    return this.logs.filter(log => {
      const logTime = new Date(log.timestamp)
      return logTime >= startTime && logTime <= endTime
    })
  }

  /**
   * Get security events (failures and denials)
   */
  getSecurityEvents(count: number = 100): AuditLogEntry[] {
    return this.logs
      .filter(log => log.result === 'failure' || log.result === 'denied')
      .slice(-count)
      .reverse()
  }

  /**
   * Get client IP (in production, from actual network request)
   */
  private getClientIP(): string {
    // In production, this would come from actual request headers
    return '10.0.1.100'
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): {
    totalEvents: number
    authenticationAttempts: number
    authenticationFailures: number
    accessDenials: number
    dataExports: number
    configChanges: number
    uniqueUsers: Set<string>
  } {
    const logsInRange = this.getLogsByTimeRange(startDate, endDate)

    return {
      totalEvents: logsInRange.length,
      authenticationAttempts: logsInRange.filter(l => l.action === 'AUTHENTICATION').length,
      authenticationFailures: logsInRange.filter(
        l => l.action === 'AUTHENTICATION' && l.result === 'failure'
      ).length,
      accessDenials: logsInRange.filter(l => l.result === 'denied').length,
      dataExports: logsInRange.filter(l => l.action === 'DATA_EXPORT').length,
      configChanges: logsInRange.filter(l => l.action === 'CONFIG_CHANGE').length,
      uniqueUsers: new Set(logsInRange.map(l => l.userId)),
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger()

// Helper function to log scenario access
export function logScenarioAccess(
  userId: string,
  username: string,
  scenarioId: string,
  scenarioName: string
): void {
  auditLogger.logDataAccess(
    userId,
    username,
    'scenario',
    scenarioId,
    `Accessed scenario: ${scenarioName}`
  )
}

// Helper function to log maneuver planning
export function logManeuverPlanning(
  userId: string,
  username: string,
  satelliteId: string,
  maneuverType: string
): void {
  auditLogger.logDataModification(
    userId,
    username,
    'maneuver_plan',
    satelliteId,
    `Created ${maneuverType} maneuver plan`
  )
}

export default auditLogger
