import { PatientWorkspaceRoute } from "./patient-workspace-route";

/**
 * The Patient Workspace route.
 *
 * This is the composition seam: `patients` supplies the shell and two of the
 * tabs, `patient-packages` supplies the third, and `packages` supplies the
 * assign dialog's picker options -- with **no import between the three
 * feature modules in either direction**. F6 and F7 append their tabs here
 * without touching any of them.
 */
export default async function PatientWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientWorkspaceRoute patientId={id} />;
}
