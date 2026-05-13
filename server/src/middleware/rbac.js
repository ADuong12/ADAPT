function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', status: 401 });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions', status: 403 });
    }
    next();
  };
}

function requireOwnerOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', status: 401 });
  }
  const resourceOwnerId = parseInt(req.params.id);
  if (req.user.teacher_id !== resourceOwnerId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied', status: 403 });
  }
  next();
}

module.exports = { requireRole, requireOwnerOrAdmin };
