"use strict";
// 📊 MONITORING & OBSERVABILITY SYSTEM
// Production-grade monitoring with metrics, alerts, and performance tracking
Object.defineProperty(exports, "__esModule", { value: true });
exports.alerts = exports.metrics = exports.monitoring = void 0;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('monitoring');
class MonitoringSystem {
    constructor() {
        this.metrics = new Map();
        this.alerts = [];
        this.performances = [];
        this.isEnabled = true;
        logger.info('📊 Monitoring system initialized');
        this.startPeriodicCleanup();
    }
    // 📊 METRICS METHODS
    incrementCounter(name, value = 1, tags) {
        this.recordMetric({
            name,
            value,
            timestamp: Date.now(),
            tags,
            type: 'counter'
        });
    }
    recordGauge(name, value, tags) {
        this.recordMetric({
            name,
            value,
            timestamp: Date.now(),
            tags,
            type: 'gauge'
        });
    }
    recordTimer(name, startTime, tags) {
        const duration = Date.now() - startTime;
        this.recordMetric({
            name,
            value: duration,
            timestamp: Date.now(),
            tags,
            type: 'timer'
        });
        return duration;
    }
    // 🚨 ALERT METHODS
    triggerAlert(severity, message, service, metadata) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            severity,
            message,
            timestamp: Date.now(),
            resolved: false,
            service
        };
        this.alerts.push(alert);
        // Log based on severity
        if (severity === 'critical' || severity === 'high') {
            logger.error(`🚨 ${severity.toUpperCase()} ALERT: ${message}`, { data: { alert, metadata } });
        }
        else {
            logger.warn(`⚠️ ${severity.toUpperCase()} ALERT: ${message}`, { data: { alert, metadata } });
        }
        // Keep only last 1000 alerts
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(-1000);
        }
        return alert.id;
    }
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            logger.info('✅ Alert resolved', { data: { alertId, alert } });
        }
    }
    // ⚡ PERFORMANCE TRACKING
    recordPerformance(event) {
        const perfEvent = {
            ...event,
            timestamp: Date.now()
        };
        this.performances.push(perfEvent);
        // Track slow operations
        if (event.duration > 5000) { // 5 seconds
            this.triggerAlert('medium', `Slow operation detected: ${event.operation} took ${event.duration}ms`, 'performance');
        }
        // Keep only last 10000 performance events
        if (this.performances.length > 10000) {
            this.performances = this.performances.slice(-10000);
        }
    }
    // 📈 ANALYTICS METHODS
    getMetrics(name, since) {
        const sinceTime = since || (Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        if (name) {
            return (this.metrics.get(name) || []).filter(m => m.timestamp >= sinceTime);
        }
        const allMetrics = [];
        for (const metricArray of this.metrics.values()) {
            allMetrics.push(...metricArray.filter(m => m.timestamp >= sinceTime));
        }
        return allMetrics;
    }
    getAlerts(severity, resolved) {
        return this.alerts.filter(alert => {
            if (severity && alert.severity !== severity)
                return false;
            if (resolved !== undefined && alert.resolved !== resolved)
                return false;
            return true;
        });
    }
    getPerformanceStats(operation, since) {
        const sinceTime = since || (Date.now() - 60 * 60 * 1000); // Last hour
        const events = this.performances.filter(p => {
            if (p.timestamp < sinceTime)
                return false;
            if (operation && p.operation !== operation)
                return false;
            return true;
        });
        if (events.length === 0) {
            return { count: 0, averageDuration: 0, successRate: 0 };
        }
        const totalDuration = events.reduce((sum, e) => sum + e.duration, 0);
        const successCount = events.filter(e => e.success).length;
        return {
            count: events.length,
            averageDuration: Math.round(totalDuration / events.length),
            successRate: Math.round((successCount / events.length) * 100),
            slowestOperation: Math.max(...events.map(e => e.duration)),
            fastestOperation: Math.min(...events.map(e => e.duration))
        };
    }
    // 📊 HEALTH METRICS
    getSystemHealth() {
        const memory = process.memoryUsage();
        const uptime = process.uptime();
        return {
            memory: {
                used: Math.round(memory.heapUsed / 1024 / 1024), // MB
                total: Math.round(memory.heapTotal / 1024 / 1024), // MB
                percentage: Math.round((memory.heapUsed / memory.heapTotal) * 100)
            },
            uptime: Math.round(uptime),
            activeAlerts: this.getAlerts(undefined, false).length,
            criticalAlerts: this.getAlerts('critical', false).length,
            recentErrors: this.performances.filter(p => !p.success && p.timestamp > Date.now() - 60 * 60 * 1000).length
        };
    }
    // 🔧 UTILITY METHODS
    recordMetric(metric) {
        if (!this.isEnabled)
            return;
        if (!this.metrics.has(metric.name)) {
            this.metrics.set(metric.name, []);
        }
        const metricArray = this.metrics.get(metric.name);
        metricArray.push(metric);
        // Keep only last 1000 metrics per name
        if (metricArray.length > 1000) {
            this.metrics.set(metric.name, metricArray.slice(-1000));
        }
    }
    startPeriodicCleanup() {
        setInterval(() => {
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            // Clean old metrics
            for (const [name, metrics] of this.metrics.entries()) {
                const recent = metrics.filter(m => m.timestamp >= oneDayAgo);
                this.metrics.set(name, recent);
            }
            // Clean old performance events
            this.performances = this.performances.filter(p => p.timestamp >= oneDayAgo);
            logger.debug('🧹 Monitoring data cleanup completed');
        }, 60 * 60 * 1000); // Every hour
    }
}
// 🌍 GLOBAL MONITORING INSTANCE
exports.monitoring = new MonitoringSystem();
// 📊 COMMON METRICS HELPERS
exports.metrics = {
    // API Metrics
    apiRequest: (endpoint, method, statusCode, duration) => {
        exports.monitoring.incrementCounter('api_requests_total', 1, { endpoint, method, status: statusCode.toString() });
        exports.monitoring.recordTimer('api_request_duration', Date.now() - duration, { endpoint, method });
        if (statusCode >= 400) {
            exports.monitoring.incrementCounter('api_errors_total', 1, { endpoint, method, status: statusCode.toString() });
        }
    },
    // Database Metrics
    dbQuery: (operation, duration, success) => {
        exports.monitoring.recordTimer('db_query_duration', Date.now() - duration, { operation });
        exports.monitoring.incrementCounter('db_queries_total', 1, { operation, success: success.toString() });
        if (!success) {
            exports.monitoring.incrementCounter('db_errors_total', 1, { operation });
        }
    },
    // Business Metrics
    videoProcessed: (userId, duration, creditsUsed) => {
        exports.monitoring.incrementCounter('videos_processed_total', 1, { user: userId });
        exports.monitoring.recordGauge('video_processing_duration', duration, { user: userId });
        exports.monitoring.recordGauge('credits_consumed', creditsUsed, { user: userId });
    },
    // User Metrics
    userAction: (action, userId) => {
        exports.monitoring.incrementCounter('user_actions_total', 1, { action, user: userId });
    }
};
// 🚨 ALERT HELPERS
exports.alerts = {
    critical: (message, service, metadata) => exports.monitoring.triggerAlert('critical', message, service, metadata),
    high: (message, service, metadata) => exports.monitoring.triggerAlert('high', message, service, metadata),
    medium: (message, service, metadata) => exports.monitoring.triggerAlert('medium', message, service, metadata),
    low: (message, service, metadata) => exports.monitoring.triggerAlert('low', message, service, metadata)
};
exports.default = exports.monitoring;
