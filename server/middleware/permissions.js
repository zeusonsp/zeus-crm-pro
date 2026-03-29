/**
 * Zeus CRM Pro v4.0 - Granular Permissions Middleware (RBAC)
 * Role-based access control with resource-level permissions
 */

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VENDOR: 'vendor',
  VIEWER: 'viewer'
};

// Permission matrix: role -> resource -> actions
const PERMISSIONS = {
  admin: {
    leads: ['create', 'read', 'update', 'delete', 'import', 'export', 'assign'],
    contracts: ['create', 'read', 'update', 'delete', 'sign'],
    orcamentos: ['create', 'read', 'update', 'delete'],
    products: ['create', 'read', 'update', 'delete'],
    campaigns: ['create', 'read', 'update', 'delete', 'send'],
    tasks: ['create', 'read', 'update', 'delete', 'assign'],
    reports: ['read', 'create', 'export', 'schedule'],
    workflows: ['create', 'read', 'update', 'delete', 'execute'],
    users: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    permissions: ['read', 'update'],
    'landing-pages': ['create', 'read', 'update', 'delete', 'publish'],
    integrations: ['create', 'read', 'update', 'delete'],
    chatbot: ['read', 'update', 'transfer'],
    nps: ['create', 'read', 'update', 'delete'],
    ai: ['read', 'execute']
  },
  manager: {
    leads: ['create', 'read', 'update', 'import', 'export', 'assign'],
    contracts: ['create', 'read', 'update', 'sign'],
    orcamentos: ['create', 'read', 'update'],
    products: ['read', 'update'],
    campaigns: ['create', 'read', 'update', 'send'],
    tasks: ['create', 'read', 'update', 'assign'],
    reports: ['read', 'export', 'schedule'],
    workflows: ['create', 'read', 'update', 'execute'],
    users: ['read'],
    settings: ['read'],
    permissions: ['read'],
    'landing-pages': ['create', 'read', 'update', 'publish'],
    integrations: ['read'],
    chatbot: ['read', 'transfer'],
    nps: ['create', 'read'],
    ai: ['read', 'execute']
  },
  vendor: {
    leads: ['create', 'read', 'update'],
    contracts: ['read', 'update'],
    orcamentos: ['create', 'read', 'update'],
    products: ['read'],
    campaigns: ['read'],
    tasks: ['create', 'read', 'update'],
    reports: ['read'],
    workflows: ['read'],
    users: [],
    settings: ['read'],
    permissions: [],
    'landing-pages': ['read'],
    integrations: [],
    chatbot: ['read'],
    nps: ['create', 'read'],
    ai: ['read', 'execute']
  },
  viewer: {
    leads: ['read'],
    contracts: ['read'],
    orcamentos: ['read'],
    products: ['read'],
    campaigns: ['read'],
    tasks: ['read'],
    reports: ['read'],
    workflows: ['read'],
    users: [],
    settings: [],
    permissions: [],
    'landing-pages': ['read'],
    integrations: [],
    chatbot: [],
    nps: ['read'],
    ai: []
  }
};

/**
 * Check if a role has permission for a specific action on a resource
 */
function hasPermission(role, resource, action) {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return false;
  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(action);
}

/**
 * Middleware factory: require specific permission
 * Usage: router.get('/leads', requirePermission('leads', 'read'), handler)
 */
function requirePermission(resource, action) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'viewer';

    // Admin bypass
    if (userRole === 'admin') return next();

    if (!hasPermission(userRole, resource, action)) {
      return res.status(403).json({
        success: false,
        error: 'Permissão negada',
        details: `Role '${userRole}' não tem permissão '${action}' no recurso '${resource}'`
      });
    }

    next();
  };
}

/**
 * Middleware: filter data by ownership (vendors only see their own leads)
 */
function filterByOwnership(req, res, next) {
  const userRole = req.user?.role || 'viewer';
  if (userRole === 'vendor') {
    req.ownershipFilter = { vendedor: req.user?.name || req.user?.email };
  }
  next();
}

/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
  return PERMISSIONS[role] || {};
}

/**
 * Get all available roles
 */
function getRoles() {
  return Object.entries(ROLES).map(([key, value]) => ({
    id: value,
    label: key,
    permissions: PERMISSIONS[value] || {}
  }));
}

module.exports = {
  ROLES, PERMISSIONS,
  hasPermission, requirePermission, filterByOwnership,
  getRolePermissions, getRoles
};
