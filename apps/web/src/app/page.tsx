import SearchExperience from "@/components/SearchExperience";
import { supabase } from "@/lib/supabase";
import type { Metro } from "@/lib/types";

// Metros come from the DB at request time; don't try to fetch during the build.
export const dynamic = "force-dynamic";

async function getMetros(): Promise<Metro[]> {
  try {
    const { data, error } = await supabase.from("metros").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Metro[];
  } catch (err) {
    console.error("Failed to load metros:", err);
    return [];
  }
}

export default async function Home() {
  const metros = await getMetros();
  return <SearchExperience metros={metros} />;
}
