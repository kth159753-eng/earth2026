import { DEFAULT_SESSION_ID } from "@/lib/exams";
import { redirect } from "next/navigation";

export default function ExamIndexPage() {
  redirect(`/exam/${DEFAULT_SESSION_ID}`);
}
