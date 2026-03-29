/**
 * Zeus CRM Pro v4.0 - Landing Pages Builder
 * Create, manage and publish landing pages with lead capture forms
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');

// GET /api/landing-pages - List all landing pages
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('landing_pages').orderBy('createdAt', 'desc').get();
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar landing pages' });
  }
});

// GET /api/landing-pages/:id - Get single landing page
router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('landing_pages').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Página não encontrada' });
    res.json({ success: true, item: doc.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar página' });
  }
});

// POST /api/landing-pages - Create landing page
router.post('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const id = uuid();
    const slug = (req.body.slug || req.body.title || id)
      .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 50);

    const page = {
      id,
      title: req.body.title || 'Nova Landing Page',
      slug,
      template: req.body.template || 'modern',
      status: req.body.status || 'draft',
      sections: req.body.sections || getDefaultSections(),
      formFields: req.body.formFields || ['nome', 'email', 'telefone', 'empresa', 'mensagem'],
      settings: {
        primaryColor: req.body.primaryColor || '#D4AF37',
        backgroundColor: req.body.backgroundColor || '#0A0A0A',
        fontFamily: req.body.fontFamily || 'system-ui',
        metaTitle: req.body.metaTitle || req.body.title || '',
        metaDescription: req.body.metaDescription || '',
        thankYouMessage: req.body.thankYouMessage || 'Obrigado! Entraremos em contato em breve.',
        redirectUrl: req.body.redirectUrl || '',
        autoTag: req.body.autoTag || slug,
        assignVendor: req.body.assignVendor || ''
      },
      analytics: { views: 0, submissions: 0, conversionRate: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('landing_pages').doc(id).set(page);

    const io = req.app.get('io');
    if (io) io.emit('landing-page-created', { id, title: page.title });

    res.status(201).json({ success: true, item: page });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao criar landing page' });
  }
});

// PUT /api/landing-pages/:id - Update landing page
router.put('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    delete updates.analytics;
    await db.collection('landing_pages').doc(req.params.id).update(updates);
    const updated = await db.collection('landing_pages').doc(req.params.id).get();
    res.json({ success: true, item: updated.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar página' });
  }
});

// DELETE /api/landing-pages/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('landing_pages').doc(req.params.id).delete();
    res.json({ success: true, message: 'Landing page removida' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao remover página' });
  }
});

// POST /api/landing-pages/:id/publish
router.post('/:id/publish', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('landing_pages').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrada' });
    const newStatus = doc.data().status === 'published' ? 'draft' : 'published';
    await db.collection('landing_pages').doc(req.params.id).update({
      status: newStatus,
      publishedAt: newStatus === 'published' ? new Date().toISOString() : null
    });
    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao publicar' });
  }
});

// GET /api/landing-pages/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('landing_pages').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrada' });
    const submissions = await db.collection('landing_page_submissions')
      .where('pageId', '==', req.params.id)
      .orderBy('createdAt', 'desc').limit(100).get();
    const subs = [];
    submissions.forEach(doc => subs.push(doc.data()));
    res.json({ success: true, analytics: doc.data().analytics, recentSubmissions: subs.slice(0, 20), totalSubmissions: subs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

// POST /api/landing-pages/submit/:slug - Public form submission (NO AUTH)
router.post('/submit/:slug', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('landing_pages')
      .where('slug', '==', req.params.slug)
      .where('status', '==', 'published').limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, error: 'Página não encontrada' });
    const page = snap.docs[0].data();
    const formData = req.body;
    const subId = uuid();
    await db.collection('landing_page_submissions').doc(subId).set({
      id: subId, pageId: page.id, pageSlug: page.slug,
      data: formData, ip: req.ip, userAgent: req.get('User-Agent'),
      createdAt: new Date().toISOString()
    });
    const leadId = uuid();
    await db.collection('leads').doc(leadId).set({
      id: leadId, nome: formData.nome || '', empresa: formData.empresa || '',
      email: formData.email || '', telefone: formData.telefone || '',
      mensagem: formData.mensagem || '', valor: 0, estagio: 'novo',
      origem: 'landing-page:' + page.slug,
      vendedor: page.settings.assignVendor || '',
      tags: ['landing-page', page.settings.autoTag || page.slug].filter(Boolean),
      notas: 'Lead capturado via landing page: ' + page.title,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    await db.collection('landing_pages').doc(page.id).update({
      'analytics.submissions': admin.firestore.FieldValue.increment(1)
    });
    const io = req.app.get('io');
    if (io) io.emit('lead-created', { id: leadId, source: 'landing-page', page: page.title });
    try {
      const workflowEngine = require('../services/workflow-engine');
      await workflowEngine.processTrigger('lead_created', {
        leadId, nome: formData.nome, email: formData.email, origem: 'landing-page:' + page.slug
      }, io);
    } catch (e) {}
    res.json({ success: true, message: page.settings.thankYouMessage, redirectUrl: page.settings.redirectUrl || null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao enviar formulário' });
  }
});

// GET /api/landing-pages/render/:slug - Render public page
router.get('/render/:slug', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('landing_pages')
      .where('slug', '==', req.params.slug)
      .where('status', '==', 'published').limit(1).get();
    if (snap.empty) return res.status(404).send('<h1>Página não encontrada</h1>');
    const page = snap.docs[0].data();
    await db.collection('landing_pages').doc(page.id).update({
      'analytics.views': admin.firestore.FieldValue.increment(1)
    });
    res.send(renderLandingPage(page, req));
  } catch (err) {
    res.status(500).send('<h1>Erro</h1>');
  }
});

function getDefaultSections() {
  return [
    { type: 'hero', title: 'Transforme seus espaços com Painéis LED', subtitle: 'Soluções profissionais em LED', ctaText: 'Solicitar Orçamento', backgroundImage: '' },
    { type: 'features', title: 'Por que escolher a Zeus?', items: [
      { icon: '⚡', title: 'Alta Resolução', description: 'Painéis de P2.5 a P10' },
      { icon: '🛠️', title: 'Instalação Completa', description: 'Equipe especializada' },
      { icon: '💰', title: 'Melhor Custo-Benefício', description: 'Preços competitivos' }
    ] },
    { type: 'form', title: 'Solicite seu Orçamento', subtitle: 'Preencha e entraremos em contato em até 24h' }
  ];
}

function renderLandingPage(page, req) {
  const { primaryColor, backgroundColor, fontFamily } = page.settings;
  const apiBase = req.protocol + '://' + req.get('host') + '/api/landing-pages';
  const sectionsHTML = (page.sections || []).map(s => {
    if (s.type === 'hero') {
      return '<section style="padding:80px 20px;text-align:center;background:linear-gradient(135deg,' + backgroundColor + ',#1a1a1a)"><h1 style="font-size:42px;color:' + primaryColor + '">' + s.title + '</h1><p style="font-size:20px;color:#ccc;max-width:600px;margin:16px auto 32px">' + s.subtitle + '</p><a href="#form" style="display:inline-block;padding:16px 40px;background:' + primaryColor + ';color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-size:18px">' + s.ctaText + '</a></section>';
    }
    if (s.type === 'features') {
      var items = (s.items || []).map(i => '<div style="flex:1;min-width:250px;padding:24px;background:#111;border-radius:12px;border:1px solid #222"><div style="font-size:36px;margin-bottom:12px">' + i.icon + '</div><h3 style="color:' + primaryColor + '">' + i.title + '</h3><p style="color:#aaa;font-size:14px">' + i.description + '</p></div>').join('');
      return '<section style="padding:60px 20px;text-align:center"><h2 style="color:#fff;font-size:28px;margin-bottom:40px">' + s.title + '</h2><div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;max-width:900px;margin:0 auto">' + items + '</div></section>';
    }
    if (s.type === 'form') {
      var fields = (page.formFields || []).map(f => {
        var labels = { nome: 'Seu Nome', email: 'E-mail', telefone: 'Telefone', empresa: 'Empresa', mensagem: 'Mensagem' };
        if (f === 'mensagem') return '<textarea name="' + f + '" placeholder="' + (labels[f] || f) + '" rows="3" style="width:100%;padding:12px;border:1px solid #333;border-radius:8px;background:#111;color:#fff;font-size:14px;resize:vertical" required></textarea>';
        return '<input name="' + f + '" type="' + (f === 'email' ? 'email' : 'text') + '" placeholder="' + (labels[f] || f) + '" style="width:100%;padding:12px;border:1px solid #333;border-radius:8px;background:#111;color:#fff;font-size:14px" required />';
      }).join('');
      return '<section id="form" style="padding:60px 20px;text-align:center"><h2 style="color:#fff;font-size:28px;margin-bottom:8px">' + s.title + '</h2><p style="color:#888;margin-bottom:32px">' + (s.subtitle || '') + '</p><form id="zeus-lp-form" style="max-width:500px;margin:0 auto;display:flex;flex-direction:column;gap:12px">' + fields + '<button type="submit" style="padding:14px;background:' + primaryColor + ';color:#000;border:none;border-radius:8px;font-weight:700;font-size:16px;cursor:pointer">Enviar</button><p id="zeus-lp-msg" style="color:#22c55e;display:none"></p></form><script>document.getElementById('zeus-lp-form').onsubmit=async function(e){e.preventDefault();var fd=new FormData(this),obj={};fd.forEach(function(v,k){obj[k]=v});try{var r=await fetch("' + apiBase + '/submit/' + page.slug + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(obj)});var d=await r.json();if(d.success){document.getElementById("zeus-lp-msg").style.display="block";document.getElementById("zeus-lp-msg").textContent=d.message;this.reset();if(d.redirectUrl)setTimeout(function(){window.location=d.redirectUrl},2000)}}catch(err){alert("Erro ao enviar. Tente novamente.")}};</script></section>';
    }
    return '';
  }).join('');
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + (page.settings.metaTitle || page.title) + '</title><meta name="description" content="' + (page.settings.metaDescription || '') + '"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:' + fontFamily + ',sans-serif;background:' + backgroundColor + ';color:#e0e0e0}</style></head><body>' + sectionsHTML + '<footer style="text-align:center;padding:32px;color:#555;font-size:12px;border-top:1px solid #1a1a1a">Zeus Tecnologia — Soluções em LED</footer></body></html>';
}

module.exports = router;
