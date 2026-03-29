/**
 * Zeus CRM Pro v4.0 - Lead Deduplication Service
 * Detects and merges duplicate leads
 */
const admin = require('firebase-admin');

/**
 * Find duplicate leads in the database
 * Uses email, phone and company name matching
 */
async function findDuplicates() {
  const db = admin.firestore();
  const snap = await db.collection('leads').get();

  const leads = [];
  snap.forEach(doc => leads.push({ id: doc.id, ...doc.data() }));

  const emailMap = {};
  const phoneMap = {};
  const duplicateGroups = [];
  const seen = new Set();

  // Group by email
  leads.forEach(lead => {
    const email = (lead.email || '').toLowerCase().trim();
    if (email && email.length > 3) {
      if (!emailMap[email]) emailMap[email] = [];
      emailMap[email].push(lead);
    }
  });

  // Group by phone (normalized)
  leads.forEach(lead => {
    const phone = (lead.telefone || '').replace(/\D/g, '');
    if (phone && phone.length >= 10) {
      if (!phoneMap[phone]) phoneMap[phone] = [];
      phoneMap[phone].push(lead);
    }
  });

  // Collect duplicate groups from emails
  Object.entries(emailMap).forEach(([email, group]) => {
    if (group.length > 1) {
      const ids = group.map(l => l.id).sort().join(',');
      if (!seen.has(ids)) {
        seen.add(ids);
        duplicateGroups.push({
          matchType: 'email',
          matchValue: email,
          leads: group,
          count: group.length
        });
      }
    }
  });

  // Collect duplicate groups from phones
  Object.entries(phoneMap).forEach(([phone, group]) => {
    if (group.length > 1) {
      const ids = group.map(l => l.id).sort().join(',');
      if (!seen.has(ids)) {
        seen.add(ids);
        duplicateGroups.push({
          matchType: 'phone',
          matchValue: phone,
          leads: group,
          count: group.length
        });
      }
    }
  });

  // Fuzzy name+company match
  for (let i = 0; i < leads.length; i++) {
    for (let j = i + 1; j < leads.length; j++) {
      const a = leads[i];
      const b = leads[j];
      const nameA = (a.nome || '').toLowerCase().trim();
      const nameB = (b.nome || '').toLowerCase().trim();
      const compA = (a.empresa || '').toLowerCase().trim();
      const compB = (b.empresa || '').toLowerCase().trim();

      if (nameA && nameB && compA && compB &&
          similarity(nameA, nameB) > 0.85 && similarity(compA, compB) > 0.85) {
        const ids = [a.id, b.id].sort().join(',');
        if (!seen.has(ids)) {
          seen.add(ids);
          duplicateGroups.push({
            matchType: 'name+company',
            matchValue: `${nameA} / ${compA}`,
            leads: [a, b],
            count: 2
          });
        }
      }
    }
  }

  return {
    totalLeads: leads.length,
    duplicateGroups: duplicateGroups.length,
    duplicateLeads: duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0),
    groups: duplicateGroups
  };
}

/**
 * Merge duplicate leads - keep the best data from each
 * @param {string} primaryId - Lead to keep
 * @param {string[]} mergeIds - Leads to merge into primary
 */
async function mergeLeads(primaryId, mergeIds) {
  const db = admin.firestore();

  const primaryDoc = await db.collection('leads').doc(primaryId).get();
  if (!primaryDoc.exists) throw new Error('Lead primário não encontrado');

  const primary = primaryDoc.data();
  const mergedNotes = [primary.notas || ''];
  const mergedTags = new Set(Array.isArray(primary.tags) ? primary.tags : []);
  let highestValue = primary.valor || 0;

  for (const mergeId of mergeIds) {
    const doc = await db.collection('leads').doc(mergeId).get();
    if (!doc.exists) continue;
    const data = doc.data();

    // Fill empty fields from duplicate
    if (!primary.nome && data.nome) primary.nome = data.nome;
    if (!primary.empresa && data.empresa) primary.empresa = data.empresa;
    if (!primary.email && data.email) primary.email = data.email;
    if (!primary.telefone && data.telefone) primary.telefone = data.telefone;
    if (!primary.vendedor && data.vendedor) primary.vendedor = data.vendedor;
    if (!primary.origem && data.origem) primary.origem = data.origem;

    // Merge tags
    if (Array.isArray(data.tags)) data.tags.forEach(t => mergedTags.add(t));

    // Keep highest value
    if ((data.valor || 0) > highestValue) highestValue = data.valor;

    // Append notes
    if (data.notas) mergedNotes.push(`[Merged from ${mergeId}] ${data.notas}`);

    // Keep best AI score
    if ((data.aiScore || 0) > (primary.aiScore || 0)) {
      primary.aiScore = data.aiScore;
      primary.aiTier = data.aiTier;
    }
  }

  // Update primary lead
  await db.collection('leads').doc(primaryId).update({
    nome: primary.nome,
    empresa: primary.empresa,
    email: primary.email,
    telefone: primary.telefone,
    vendedor: primary.vendedor,
    origem: primary.origem,
    valor: highestValue,
    tags: Array.from(mergedTags),
    notas: mergedNotes.filter(Boolean).join('\n---\n'),
    aiScore: primary.aiScore,
    aiTier: primary.aiTier,
    updatedAt: new Date().toISOString(),
    mergedFrom: mergeIds,
    mergedAt: new Date().toISOString()
  });

  // Delete merged leads
  const batch = db.batch();
  for (const id of mergeIds) {
    batch.delete(db.collection('leads').doc(id));
  }
  await batch.commit();

  return { primaryId, mergedCount: mergeIds.length, deletedIds: mergeIds };
}

/**
 * Auto-merge all obvious duplicates (same email)
 */
async function autoMerge() {
  const result = await findDuplicates();
  let totalMerged = 0;
  const mergeResults = [];

  for (const group of result.groups) {
    if (group.matchType === 'email' && group.count === 2) {
      // Auto-merge: keep the one with more data
      const sorted = group.leads.sort((a, b) => {
        const scoreA = [a.nome, a.empresa, a.email, a.telefone, a.notas].filter(Boolean).length;
        const scoreB = [b.nome, b.empresa, b.email, b.telefone, b.notas].filter(Boolean).length;
        return scoreB - scoreA;
      });

      try {
        const r = await mergeLeads(sorted[0].id, [sorted[1].id]);
        mergeResults.push(r);
        totalMerged++;
      } catch (err) {
        console.error('[Dedup] Merge error:', err.message);
      }
    }
  }

  return { totalMerged, mergeResults };
}

// Simple string similarity (Dice coefficient)
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bi = a.substring(i, i + 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }
  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bi = b.substring(i, i + 2);
    const count = bigrams.get(bi) || 0;
    if (count > 0) { bigrams.set(bi, count - 1); intersect++; }
  }
  return (2 * intersect) / (a.length + b.length - 2);
}

module.exports = { findDuplicates, mergeLeads, autoMerge };
