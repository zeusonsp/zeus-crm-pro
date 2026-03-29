/**
 * Zeus CRM Pro v4.0 - Push Notifications & PWA Enhancement
 * Web Push API for real-time notifications even when app is closed
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');
const crypto = require('crypto');

