import { createServerClient } from "@/lib/supabase";
import { buildDigest } from "@/lib/digest";
import { getPageUser } from "@/lib/supabase-ssr";
import { userProjectIds } from "@/lib/api-guard";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, PageTitle, Chip } from "@/components/ui";
import EmailDigestButton from "./EmailDigestButton";

export default async function DigestPage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person } = await params;
  const name = decodeURIComponent(person);
  const supabase = createServerClient();
  const user = await getPageUser();
  if (!user) redirect("/login");
  const projectIds = await userProjectIds(supabase, user.id);
  const d = await buildDigest(supabase, name, projectIds);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="p-6 mb-5">
      <h3 className="text-xs uppercase tracking-wider text-[#9B9690] mb-3">{title}</h3>
      {children}
    </Card>
  );

  const openTasks = d.actions.filter((a) => a.status === "open");

  return (
    <AppShell>
      <PageTitle aside={<EmailDigestButton person={name} />}>
        Weekly Digest
      </PageTitle>

      <p className="text-[#6B6560] -mt-4 mb-8 capitalize">{name}</p>

      <Section title="Your open tasks">
        {openTasks.length ? (
          <ul className="space-y-2">
            {openTasks.map((a, i) => (
              <li key={i} className="text-[#1A1715] text-sm flex gap-2">
                <span className="text-[#9B9690]">•</span>
                <span>
                  {a.title}
                  {a.due_date ? (
                    <span className="text-[#9B9690]"> — due {new Date(a.due_date).toLocaleString()}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#9B9690] italic text-sm">No open tasks.</p>
        )}
      </Section>

      <Section title="What changed this week">
        {d.changed.length ? (
          <ul className="space-y-2.5">
            {d.changed.map((c, i) => (
              <li
                key={i}
                className={`text-sm flex flex-wrap items-center gap-2 ${
                  c.status !== "active" ? "line-through text-[#9B9690]" : "text-[#1A1715]"
                }`}
              >
                <Chip tone="neutral">{c.topic}</Chip>
                <span>&ldquo;{c.exact_quote}&rdquo;</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#9B9690] italic text-sm">Nothing changed this week.</p>
        )}
      </Section>

      <Section title="Open objections involving you">
        {d.objections.length ? (
          <ul className="space-y-2.5">
            {d.objections.map((o, i) => (
              <li key={i} className="text-[#1A1715] text-sm">
                &ldquo;{o.old_quote}&rdquo; vs &ldquo;{o.new_quote}&rdquo;
                {o.verdict ? (
                  <span className="text-[#6B6560]"> → {o.verdict}</span>
                ) : (
                  <span className="text-[#C0392B]"> (unresolved)</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#9B9690] italic text-sm">No objections involving you.</p>
        )}
      </Section>
    </AppShell>
  );
}
