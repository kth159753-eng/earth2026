import { TeacherGate } from "@/components/TeacherGate";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeacherGate>{children}</TeacherGate>;
}
