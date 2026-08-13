import { ConsultationRouteContent } from "@/features/consultations";

/**
 * The Consultation destination (`UX.md` Sitemap). A nested route rather than
 * a contextual surface: ADR-0001 sanctions a child that is itself a
 * substantial workspace, and this one hosts the prescription section.
 */
export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsultationRouteContent appointmentId={id} />;
}
