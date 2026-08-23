import { DEFAULT_SESSION_ID } from "@/lib/exams";
import { redirect } from "next/navigation";

export default function PapersIndexPage() {
  redirect(`/papers/${DEFAULT_SESSION_ID}`);
}
