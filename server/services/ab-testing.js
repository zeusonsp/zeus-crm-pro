/**
 * Zeus CRM Pro v4.0 - A/B Testing Service
 * Split campaign audiences and track variant performance
 */
const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');

/**
 * Create an A/B test for a campaign
 */
async function createABTest(campaignId, variants) {
  const db = admin.firestore();
  const id = uuid();

  // Validate variants
  if (!variants || variants.length < 2) {
    throw new Error('É necessário pelo menos 2 variantes para A/B testing');
  }

  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 50), 0);

  const test = {
    id,
    campaignId,
    status: 'draft', // draft, running, completed
    variants: variants.map((v, i) => ({
      id: `variant_${String.fromCharCode(65 + i)}`, // A, B, C...
      name: v.name || `Variante ${String.fromCharCode(65 + i)}`,
      subject: v.subject || '',
      content: v.content || '',
      weight: Math.round(((v.weight || 50) / totalWeight) * 100),
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 }
    })),
    winnerCriteria: 'open_rate', // open_rate, click_rate, conversion_rate
    testDuration: 24, // hours before declaring winner
    winnerId: null,
    totalAudience: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection('ab_tests').doc(id).set(test);
  return test;
}

/**
 * Split audience into variant groups
 */
function splitAudience(audience, variants) {
  const shuffled = [...audience].sort(() => Math.random() - 0.5);
  const groups = {};
  let index = 0;

  for (const variant of variants) {
    const count = Math.round(shuffled.length * (variant.weight / 100));
    groups[variant.id] = shuffled.slice(index, index + count);
    index += count;
  }

  // Assign remaining to first variant
  if (index < shuffled.length) {
    groups[variants[0].id] = [...(groups[variants[0].id] || []), ...shuffled.slice(index)];
  }

  return groups;
}

/**
 * Record an event (open, click, conversion) for a variant
 */
async function recordEvent(testId, variantId, eventType, leadId) {
  const db = admin.firestore();
  const doc = await db.collection('ab_tests').doc(testId).get();
  if (!doc.exists) throw new Error('A/B test não encontrado');

  const test = doc.data();
  const variant = test.variants.find(v => v.id === variantId);
  if (!variant) throw new Error('Variante não encontrada');

  // Update stats
  const statsField = {
    'open': 'opened',
    'click': 'clicked',
    'convert': 'converted',
    'deliver': 'delivered'
  }[eventType] || eventType;

  if (variant.stats[statsField] !== undefined) {
    variant.stats[statsField]++;
  }

  await db.collection('ab_tests').doc(testId).update({
    variants: test.variants,
    updatedAt: new Date().toISOString()
  });

  // Record individual event
  await db.collection('ab_test_events').add({
    testId,
    variantId,
    eventType,
    leadId,
    timestamp: new Date().toISOString()
  });

  return { recorded: true };
}

/**
 * Calculate results and determine winner
 */
async function calculateResults(testId) {
  const db = admin.firestore();
  const doc = await db.collection('ab_tests').doc(testId).get();
  if (!doc.exists) throw new Error('A/B test não encontrado');

  const test = doc.data();
  const results = test.variants.map(v => {
    const sent = v.stats.sent || 1;
    return {
      ...v,
      openRate: ((v.stats.opened / sent) * 100).toFixed(1),
      clickRate: ((v.stats.clicked / sent) * 100).toFixed(1),
      conversionRate: ((v.stats.converted / sent) * 100).toFixed(1)
    };
  });

  // Determine winner based on criteria
  const criteria = test.winnerCriteria || 'open_rate';
  const metricKey = {
    'open_rate': 'openRate',
    'click_rate': 'clickRate',
    'conversion_rate': 'conversionRate'
  }[criteria] || 'openRate';

  const sorted = results.sort((a, b) => parseFloat(b[metricKey]) - parseFloat(a[metricKey]));
  const winner = sorted[0];

  // Statistical significance (simplified)
  const topTwo = sorted.slice(0, 2);
  const diff = parseFloat(topTwo[0][metricKey]) - parseFloat(topTwo[1]?.[metricKey] || 0);
  const isSignificant = diff > 2; // >2% difference considered significant

  await db.collection('ab_tests').doc(testId).update({
    winnerId: winner.id,
    status: 'completed',
    results: {
      variants: results,
      winner: winner.id,
      winnerName: winner.name,
      isStatisticallySignificant: isSignificant,
      improvement: `${diff.toFixed(1)}%`
    },
    completedAt: new Date().toISOString()
  });

  return {
    winner,
    results,
    isStatisticallySignificant: isSignificant,
    improvement: `${diff.toFixed(1)}%`
  };
}

/**
 * List A/B tests
 */
async function listTests(campaignId) {
  const db = admin.firestore();
  let query = db.collection('ab_tests').orderBy('createdAt', 'desc');
  if (campaignId) query = query.where('campaignId', '==', campaignId);
  const snap = await query.limit(50).get();
  const items = [];
  snap.forEach(doc => items.push(doc.data()));
  return items;
}

module.exports = { createABTest, splitAudience, recordEvent, calculateResults, listTests };
