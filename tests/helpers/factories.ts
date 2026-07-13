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

export const validPatientInput = (suffix = "001") => ({
  fullName: `Test Patient ${suffix}`,
  gender: "other" as const,
  phone: "9876543210",
  email: `patient-${suffix}@example.test`,
  address: "123 Test Street",
  emergencyContact: "Emergency Contact 9999999999",
});

export const validAppointmentInput = (overrides: {
  patientId: string;
  clinicId: string;
  physiotherapistId: string;
}) => ({
  patientId: overrides.patientId,
  clinicId: overrides.clinicId,
  physiotherapistId: overrides.physiotherapistId,
  appointmentTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  appointmentType: "therapy_session" as const,
});

export const validConsultationInput = (appointmentId: string) => ({
  appointmentId,
  symptoms: "Lower back pain",
  painAreas: ["lower_back"],
  painScale: 5,
  diagnosisNotes: "Muscular strain",
  followupNotes: "Review in one week",
});

export const validPrescriptionInput = (consultationId: string) => ({
  consultationId,
  advice: "Apply ice pack twice daily",
  followupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
});

export const validPackageInput = (suffix = "001") => ({
  packageName: `Test Package ${suffix}`,
  totalSessions: 10,
  packagePrice: 5000,
  validityDays: 90,
});

export const validPatientPackageInput = (overrides: { patientId: string; packageId: string }) => ({
  patientId: overrides.patientId,
  packageId: overrides.packageId,
});

export const validInvoiceInput = (overrides: { patientId: string; clinicId: string }) => ({
  patientId: overrides.patientId,
  clinicId: overrides.clinicId,
  discountAmount: 0,
  items: [{ itemName: "Consultation Fee", quantity: 1, unitPrice: 500, gstPercent: 18 }],
});

export const validPaymentInput = (invoiceId: string) => ({
  invoiceId,
  amount: 590,
  paymentMode: "cash" as const,
});

export const validAttendanceInput = (overrides: { clinicId: string; userId?: string }) => ({
  clinicId: overrides.clinicId,
  userId: overrides.userId,
  status: "present" as const,
});

export const validNotificationInput = (overrides: { userId: string }) => ({
  recipientType: "user" as const,
  userId: overrides.userId,
  notificationType: "appointment_reminder",
  channel: "in_app" as const,
  message: "Your appointment is coming up.",
});
