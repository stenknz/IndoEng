import { redirect } from "next/navigation";
import { getLesson } from "@/lib/data/lessons";
import { LessonFlow } from "@/components/LessonFlow";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) redirect("/");
  return <LessonFlow lesson={lesson} />;
}
