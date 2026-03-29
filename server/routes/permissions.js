/**
 * Zeus CRM Pro v4.0 - Permissions Management Routes
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const { getRoles, getRolePermissions, PERMISSIONS } = require('../middleware/permissions');

// GET /api/permissions/roles - List all roles and their permissions
router.get('/roles', (req, res) => {
  res.json({ success: true, roles: getRoles() });
});

// GET /api/permissions/roles/:role - Get permissions for a specific role
router.get('/roles/:role', (req, res) => {
  const perms = getRolePermissions(req.params.role);
  if (Object.keys(perms).length === 0) {
    return res.status(404).json({ success: false, error: 'Role não encontrada' });
  }
  res.json({ success: true, role: req.params.role, permissions: perms });
});

// PUT /api/permissions/users/:userId/role - Assign role to user
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'manager', 'vendor', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role inválida. Use: admin, manager, vendor, viewer' });
    }

    const db = admin.firestore();
    await db.collection('users').doc(req.params.userId).update({
      role,
      updatedAt: new Date().toISOString()
    });

    const io = req.app.get('io');
    if (io) io.emit('user-role-changed', { userId: req.params.userId, role });

    res.json({ success: true, userId: req.params.userId, role });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atribuir role' });
  }
});

// GET /api/permissions/users - List users with their roles
router.get('/users', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('users').get();
    const items = [];
    snap.forEach(doc => {
      const d = doc.data();
      items.push({ id: doc.id, name: d.name, email: d.email, role: d.role || 'vendor' });
    });
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar usuários' });
  }
});

// PUT /api/permissions/custom/:role - Update custom permissions for a role
router.put('/custom/:role', async (req, res) => {
  try {
    const { permissions } = req.body;
    const db = admin.firestore();

    await db.collection('custom_permissions').doc(req.params.role).set({
      role: req.params.role,
      permissions,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, role: req.params.role, permissions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar permissões' });
  }
});

// GET /api/permissions/my - Get current user's permissions
router.get('/my', (req, res) => {
  const role = req.user?.role || 'viewer';
  res.json({
    success: true,
    role,
    permissions: getRolePermissions(role)
  });
});

module.exports = router;
