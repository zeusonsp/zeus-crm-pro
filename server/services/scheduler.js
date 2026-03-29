/**
 * Zeus CRM Pro v4.0 - Scheduled Reports Service
 * Automated report generation + email delivery via node-cron
 */
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const config = require('../config/env');
const reportExporter = require('./reportExporter');

const activeJobs = new Map();
