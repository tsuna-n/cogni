export function getUserRole(user) {
  // Privileged roles must be explicitly assigned in the account store.
  return ["admin", "researcher"].includes(user?.role) ? user.role : "user";
}

export function isAdminUser(user) {
  return Boolean(user?.email) && getUserRole(user) === "admin";
}

export function canManageUsers(user) {
  return Boolean(user?.email) && ["admin", "researcher"].includes(getUserRole(user));
}

export function canReadResearchRecord(user, record) {
  return Boolean(user?.email && record) &&
    (canManageUsers(user) || record.uploadedBy === user.email);
}
