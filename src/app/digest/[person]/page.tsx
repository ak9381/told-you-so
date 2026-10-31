import { createServerClient } from "@/lib/supabase";
import { buildDigest } from "@/lib/digest";
import Masthead from "@/components/Masthead";
import Nav from "@/components/Nav";
import EmailDigestButton from "./EmailDigestButton";

export default async function DigestPage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person } = await params;
  const name = decodeURIComponent(person);
  const supabase = createServerClient();
  const d = await buildDigest(supabase, name);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-6">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#C0392B] mb-2">{title}</h3>
      {children}
    </section>
  );

  const openTasks = d.actions.filter((a) => a.status === "open");

  return (
    <main className="max-w-3xl mx-auto px-6 py-8 min-h-screen">
      <Masthead />
      <Nav />

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl font-bold text-[#1C1917]">Weekly Digest — {name}</h2>
        <EmailDigestButton person={name} />
      </div>

      <div className="border border-[#DDD3C1] bg-[#FAF7F2] p-6 font-mono text-xs">
        <Section title="Your open tasks">
          {openTasks.length ? (
            <ul className="space-y-1">
              {openTasks.map((a, i) => (
                <li key={i} className="text-[#1C1917]">
                  • {a.title}
                  {a.due_date ? <span className="text-[#78716C]"> — due {new Date(a.due_date).toLocaleString()}</span> : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#78716C] italic">No open tasks.</p>
          )}
        </Section>

        <Section title="What changed this week">
          {d.changed.length ? (
            <ul className="space-y-1">
              {d.changed.map((c, i) => (
                <li key={i} className={c.status !== "active" ? "line-through text-[#A8A29E]" : "text-[#1C1917]"}>
                  <span className="uppercase text-[9px] text-[#78716C]">[{c.topic}]</span> &ldquo;{c.exact_quote}&rdquo;
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#78716C] italic">Nothing changed this week.</p>
          )}
        </Section>

        <Section title="Open objections involving you">
          {d.objections.length ? (
            <ul className="space-y-1">
              {d.objections.map((o, i) => (
                <li key={i} className="text-[#1C1917]">
                  &ldquo;{o.old_quote}&rdquo; vs &ldquo;{o.new_quote}&rdquo;
                  {o.verdict ? <span className="text-[#78716C]"> → {o.verdict}</span> : <span className="text-[#C0392B]"> (unresolved)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#78716C] italic">No objections involving you.</p>
          )}
        </Section>
      </div>
    </main>
  );
}
