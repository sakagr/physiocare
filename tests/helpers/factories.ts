export const validOrganizationInput = (suffix = "001") => ({
  organizationName: `Test Physio ${suffix}`,
  adminFullName: "Test Owner",
  adminEmail: `owner-${suffix}@example.test`,
  adminUsername: `owner-${suffix}`,
});

export const validOrganizationUserInput = (suffix = "001") => ({
  fullName: "Test Physiotherapist",
  username: `physio-${suffix}`,
  email: `physio-${suffix}@example.test`,
  phone: "9876543210",
  role: "ORG_PHYSIOTHERAPIST" as const,
});

export const validClinicInput = (suffix = "001") => ({
  clinicName: `Test Clinic ${suffix}`,
  email: `clinic-${suffix}@example.test`,
  phone: "9876543210",
  city: "Pune",
});
