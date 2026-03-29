/**
 * Zeus CRM Pro v4.0 - AI Chatbot Routes
 * Customer-facing chatbot + admin management
 */
const router = require('express').Router();
const chatService = require('../services/chatbot');
const { v4: uuid } = require('uuid');
