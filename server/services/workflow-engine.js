/**
 * Zeus CRM Pro v4.0 - Workflow Automation Engine
 * Visual workflow builder with triggers, conditions, and actions
 */
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const config = require('../config/env');

const TRIGGER_TYPES = {
  LEAD_CREATED: 'lead_created',
  LEAD_STAGE_CHANGED: 'lead_stage_changed',
  LEAD_SCORE_CHANGED: 'lead_score_changed',
  DEAL_WON: 'deal_won',
  DEAL_LOST: 'deal_lost',
  CONTRACT_SIGNED: 'contract_signed',
  TASK_OVERDUE: 'task_overdue',
  NPS_RECEIVED: 'nps_received',
  SCHEDULE: 'schedule',       // Time-based (cron)
  WEBHOOK: 'webhook_received'
};

const ACTION_TYPES = {
  SEND_EMAIL: 'send_email',
  SEND_SMS: 'send_sms',
  SEND_WHATSAPP: 'send_whatsapp',
  CHANGE_STAGE: 'change_stage',
  ASSIGN_VENDOR: 'assign_vendor',
  ADD_TAG: 'add_tag',
  REMOVE_TAG: 'remove_tag',
  CREATE_TASK: 'create_task',
  UPDATE_FIELD: 'update_field',
  WAIT: 'wait',               // Delay (minutes/hours/days)
  CONDITION: 'condition',      // If/else branch
  AI_QUALIFY: 'ai_qualify',
  NOTIFY_TEAM: 'notify_team'
};

const CONDITION_OPERATORS = {
  equals: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
  not_equals: (a, b) => String(a).toLowerCase() !== String(b).toLowerCase(),
  contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  greater_than: (a, b) => parseFloat(a) > parseFloat(b),
  less_than: (a, b) => parseFloat(a) < parseFloat(b),
  is_empty: (a) => !a || String(a).trim() === '',
  is_not_empty: (a) => a && String(a).trim() !== ''
};

/**
 * Create a new workflow
 */
async function createWorkflow(data) {
  const db = admin.firestore();
  const id = require('uuid').v4();

  const workflow = {
    id,
    name: data.name,
    description: data.description || '',
    trigger: data.trigger, // { type, config }
    steps: data.steps || [], // [{ type, config, nextOnSuccess, nextOnFailure }]
    active: data.active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0,
    lastExecutedAt: null
  };

  await db.collection('workflows').doc(id).set(workflow);
  return workflow;
}

/**
 * Execute a workflow for a given trigger event
 */
async function executeWorkflow(workflowId, triggerData) {
  const db = admin.firestore();
  const doc = await db.collection('workflows').doc(workflowId).get();
  if (!doc.exists) throw new Error('Workflow não encontrado');

  const workflow = doc.data();
  if (!workflow.active) return { skipped: true, reason: 'Workflow inativo' };

  const executionId = require('uuid').v4();
  const log = {
    id: executionId,
    workflowId,
    workflowName: workflow.name,
    triggerData,
    startedAt: new Date().toISOString(),
    steps: [],
    status: 'running'
  };

  try {
    let context = { ...triggerData, _results: {} };

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepLog = { index: i, type: step.type, startedAt: new Date().toISOString() };

      try {
        // Check condition if present
        if (step.condition) {
          const passes = evaluateCondition(step.condition, context);
          if (!passes) {
            stepLog.status = 'skipped';
            stepLog.reason = 'Condition not met';
            log.steps.push(stepLog);
            continue;
          }
        }

        const result = await executeStep(step, context);
        context._results[`step_${i}`] = result;
        stepLog.status = 'success';
        stepLog.result = result;
      } catch (stepErr) {
        stepLog.status = 'error';
        stepLog.error = stepErr.message;
        if (step.stopOnError !== false) {
          log.status = 'error';
          log.error = stepErr.message;
          break;
        }
      }

      stepLog.completedAt = new Date().toISOString();
      log.steps.push(stepLog);
    }

    if (log.status !== 'error') log.status = 'completed';
  } catch (err) {
    log.status = 'error';
    log.error = err.message;
  }

  log.completedAt = new Date().toISOString();

  // Save execution log
  await db.collection('workflow_executions').doc(executionId).set(log);

  // Update workflow stats
  await db.collection('workflows').doc(workflowId).update({
    executionCount: admin.firestore.FieldValue.increment(1),
    lastExecutedAt: new Date().toISOString()
  });

  return log;
}

/**
 * Execute a single workflow step
 */
async function executeStep(step, context) {
  const db = admin.firestore();

  switch (step.type) {
    case ACTION_TYPES.SEND_EMAIL: {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host, port: config.smtp.port,
        auth: { user: config.smtp.user, pass: config.smtp.pass }
      });
      const to = resolveTemplate(step.config.to, context);
      const subject = resolveTemplate(step.config.subject, context);
      const html = resolveTemplate(step.config.body, context);
      await transporter.sendMail({ from: config.smtp.from, to, subject, html });
      return { sent: true, to };
    }

    case ACTION_TYPES.SEND_SMS: {
      const smsService = require('./sms');
      const phone = resolveTemplate(step.config.phone, context);
      const message = resolveTemplate(step.config.message, context);
      await smsService.sendSMS(phone, message);
      return { sent: true, phone };
    }

    case ACTION_TYPES.CHANGE_STAGE: {
      const leadId = context.leadId || context.id;
      if (leadId) {
        await db.collection('leads').doc(leadId).update({
          estagio: step.config.newStage,
          updatedAt: new Date().toISOString()
        });
      }
      return { updated: true, newStage: step.config.newStage };
    }

    case ACTION_TYPES.ASSIGN_VENDOR: {
      const leadId = context.leadId || context.id;
      if (leadId) {
        await db.collection('leads').doc(leadId).update({
          vendedor: step.config.vendor,
          updatedAt: new Date().toISOString()
        });
      }
      return { assigned: true, vendor: step.config.vendor };
    }

    case ACTION_TYPES.ADD_TAG: {
      const leadId = context.leadId || context.id;
      if (leadId) {
        await db.collection('leads').doc(leadId).update({
          tags: admin.firestore.FieldValue.arrayUnion(step.config.tag),
          updatedAt: new Date().toISOString()
        });
      }
      return { added: true, tag: step.config.tag };
    }

    case ACTION_TYPES.REMOVE_TAG: {
      const leadId = context.leadId || context.id;
      if (leadId) {
        await db.collection('leads').doc(leadId).update({
          tags: admin.firestore.FieldValue.arrayRemove(step.config.tag),
          updatedAt: new Date().toISOString()
        });
      }
      return { removed: true, tag: step.config.tag };
    }

    case ACTION_TYPES.CREATE_TASK: {
      const taskId = require('uuid').v4();
      await db.collection('tasks').doc(taskId).set({
        id: taskId,
        title: resolveTemplate(step.config.title, context),
        description: resolveTemplate(step.config.description || '', context),
        assignee: step.config.assignee || context.vendedor || '',
        dueDate: step.config.dueDays
          ? new Date(Date.now() + step.config.dueDays * 86400000).toISOString()
          : null,
        status: 'pending',
        leadId: context.leadId || context.id || null,
        createdBy: 'workflow',
        createdAt: new Date().toISOString()
      });
      return { created: true, taskId };
    }

    case ACTION_TYPES.UPDATE_FIELD: {
      const leadId = context.leadId || context.id;
      if (leadId) {
        await db.collection('leads').doc(leadId).update({
          [step.config.field]: step.config.value,
          updatedAt: new Date().toISOString()
        });
      }
      return { updated: true, field: step.config.field };
    }

    case ACTION_TYPES.WAIT: {
      const ms = (step.config.minutes || 0) * 60000 +
                 (step.config.hours || 0) * 3600000 +
                 (step.config.days || 0) * 86400000;
      // In production, this would schedule via node-cron or a queue
      // For now, we record the delay for the execution log
      return { delayed: true, duration: ms, unit: 'ms' };
    }

    case ACTION_TYPES.AI_QUALIFY: {
      const aiService = require('./ai');
      const leadId = context.leadId || context.id;
      if (leadId) {
        const leadDoc = await db.collection('leads').doc(leadId).get();
        if (leadDoc.exists) {
          const result = await aiService.qualifyLead(leadDoc.data());
          await db.collection('leads').doc(leadId).update({
            aiScore: result.score,
            aiTier: result.tier,
            aiQualifiedAt: new Date().toISOString()
          });
          return { qualified: true, score: result.score, tier: result.tier };
        }
      }
      return { qualified: false, reason: 'Lead not found' };
    }

    case ACTION_TYPES.NOTIFY_TEAM: {
      // Emit via Socket.IO
      return { notified: true, message: step.config.message };
    }

    default:
      return { skipped: true, reason: `Unknown action: ${step.type}` };
  }
}

/**
 * Evaluate a condition against context
 */
function evaluateCondition(condition, context) {
  const { field, operator, value } = condition;
  const fieldValue = getNestedField(context, field);
  const fn = CONDITION_OPERATORS[operator];
  if (!fn) return true;
  return fn(fieldValue, value);
}

/**
 * Resolve template variables like {{nome}}, {{empresa}}
 */
function resolveTemplate(template, context) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] || match;
  });
}

function getNestedField(obj, path) {
  return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

/**
 * Process trigger events from the system
 */
async function processTrigger(triggerType, triggerData, io) {
  const db = admin.firestore();
  const snap = await db.collection('workflows')
    .where('active', '==', true)
    .where('trigger.type', '==', triggerType)
    .get();

  const results = [];
  for (const doc of snap.docs) {
    const workflow = doc.data();
    try {
      const result = await executeWorkflow(workflow.id, triggerData);
      results.push({ workflowId: workflow.id, name: workflow.name, status: result.status });

      if (io) io.emit('workflow-executed', {
        workflowId: workflow.id,
        name: workflow.name,
        status: result.status
      });
    } catch (err) {
      results.push({ workflowId: workflow.id, error: err.message });
    }
  }

  return results;
}

module.exports = {
  TRIGGER_TYPES, ACTION_TYPES,
  createWorkflow, executeWorkflow, processTrigger,
  evaluateCondition, resolveTemplate
};
