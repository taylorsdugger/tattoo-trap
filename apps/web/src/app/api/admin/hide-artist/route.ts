import { NextResponse } from "next/server";
import { getCurrentRole, getCurrentUser, hasMinRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/* Admin curation endpoint: hide / unhide a junk artist on the deployed site, where the hard delete
   isn't available (that needs the service-role key, which only lives on localhost). A hidden row
   drops the artist from every public listing and queues it for the operator to delete locally via
   /admin/hidden.

   Unlike delete-artist, this writes through the operator's own authenticated client (their JWT),
   not the service role — so it works in production. RLS on `hidden_artists` permits authenticated
   writes; we still authorize by role here for a clean 403 and defense in depth. */

export async function POST(req: Request) {
  const role = await getCurrentRole();
  if (!hasMinRole(role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Body must be { id: number }" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("hidden_artists")
    .upsert({ artist_id: id, hidden_by: user?.id ?? null }, { onConflict: "artist_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hidden: true });
}

export async function DELETE(req: Request) {
  const role = await getCurrentRole();
  if (!hasMinRole(role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Body must be { id: number }" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hidden_artists").delete().eq("artist_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hidden: false });
}
