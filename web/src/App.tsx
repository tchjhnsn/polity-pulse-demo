import { useMemo } from "react";
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ExperimentalBanner } from "@/components/pulse/ExperimentalBanner";
import { AppHeader } from "@/components/pulse/AppHeader";
import { StatusStrip } from "@/components/pulse/StatusStrip";
import { FeedList } from "@/components/pulse/FeedList";
import { FeedCard } from "@/components/pulse/FeedCard";
import { AddressInput } from "@/components/pulse/AddressInput";
import { OrientationView } from "@/components/pulse/OrientationView";
import { RepsDirectory } from "@/components/pulse/RepsDirectory";
import { RepPage } from "@/components/pulse/RepPage";
import { BillsIndex } from "@/components/pulse/BillsIndex";
import { BillPage } from "@/components/pulse/BillPage";
import { usePulse } from "@/lib/usePulse";
import { useOrient } from "@/lib/useOrient";

/** Shared page chrome: banner + nav + centered column. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <ExperimentalBanner text="Experimental preview — not part of the live Polity product." />
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-4 py-5">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<OrientRoute />} />
        <Route path="/reps" element={<RepsRoute />} />
        <Route path="/rep/:slug" element={<RepRoute />} />
        <Route path="/bills" element={<BillsRoute />} />
        <Route path="/bill/:slug" element={<BillRoute />} />
        <Route path="/pulse" element={<PulseRoute />} />
      </Routes>
    </HashRouter>
  );
}

/** Home — Orient: address → your officials. The personalized hero (F1). */
function OrientRoute() {
  const orient = useOrient();
  const navigate = useNavigate();
  return (
    <Shell>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold text-accent-blue">Orient</h1>
        <p className="mt-1 text-small text-ink-3">
          Enter your address to see everyone who governs it — across four layers
          of government.
        </p>
      </header>
      <div className="space-y-4">
        <AddressInput onSubmit={orient.orient} loading={orient.loading} />
        <OrientationView
          result={orient.data}
          loading={orient.loading}
          error={orient.error}
          onOpenRep={(slug) => navigate(`/rep/${slug}`)}
        />
      </div>
    </Shell>
  );
}

/** Reps — the directory (address-optional browse). */
function RepsRoute() {
  const navigate = useNavigate();
  return (
    <Shell>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold text-accent-blue">Reps</h1>
        <p className="mt-1 text-small text-ink-3">
          Browse everyone who governs a Travis County address. Filter by what an
          office actually does.
        </p>
      </header>
      <RepsDirectory onOpenRep={(slug) => navigate(`/rep/${slug}`)} />
    </Shell>
  );
}

/** Rep detail. */
function RepRoute() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  return (
    <Shell>
      <RepPage
        slug={slug ?? ""}
        onBack={() => navigate("/reps")}
        onOpenBill={(billSlug) => navigate(`/bill/${billSlug}`)}
      />
    </Shell>
  );
}

/** Bills index. */
function BillsRoute() {
  const navigate = useNavigate();
  return (
    <Shell>
      <BillsIndex onOpenBill={(slug) => navigate(`/bill/${slug}`)} />
    </Shell>
  );
}

/** Bill detail. */
function BillRoute() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  return (
    <Shell>
      <BillPage
        slug={slug ?? ""}
        onBack={() => navigate("/bills")}
        onOpenRep={(repSlug) => navigate(`/rep/${repSlug}`)}
      />
    </Shell>
  );
}

/** Pulse — the agent heartbeat / diagnostic view (demoted from primary).
 *  Phase III: items split into what the agent FILED (attributed to a bill or
 *  rep) vs. the UNATTRIBUTED WIRE (news it couldn't place). The filing is the
 *  visible "agent does something useful with the live data" behavior. */
function PulseRoute() {
  const { data, error, loading, paused, pause, resume, refresh } = usePulse();
  const navigate = useNavigate();

  const { filed, wire } = useMemo(() => {
    const items = data?.items ?? [];
    return {
      filed: items.filter((i) => i.attribution),
      wire: items.filter((i) => !i.attribution),
    };
  }, [data?.items]);

  const openBill = (slug: string) => navigate(`/bill/${slug}`);
  const openRep = (slug: string) => navigate(`/rep/${slug}`);

  return (
    <Shell>
      <header className="mb-3">
        <h1 className="text-[22px] font-semibold text-accent-blue">
          Live Pulse
        </h1>
        <p className="mt-1 text-small text-ink-3">
          The agent's heartbeat. Each beat it files live items against the bills
          and reps they're about; what it can't place stays on the wire.
        </p>
      </header>

      <StatusStrip
        data={data}
        paused={paused}
        onPause={pause}
        onResume={resume}
        onRefresh={refresh}
      />

      {error && (
        <div className="pb-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Dashboard fetch error: {error}. Retrying on next beat.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mt-4 space-y-5">
        <section className="space-y-2.5">
          <div className="px-1 text-mono uppercase tracking-[0.08em] text-ink-2">
            Filed this beat · {filed.length}
          </div>
          {filed.length === 0 && !loading ? (
            <p className="px-1 text-small text-ink-3">
              Nothing filed yet — waiting for items the agent can match to a
              bill or rep.
            </p>
          ) : (
            <div className="space-y-2.5">
              {filed.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onOpenBill={openBill}
                  onOpenRep={openRep}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2.5">
          <div className="px-1 text-mono uppercase tracking-[0.08em] text-ink-3">
            Unattributed wire · {wire.length}
          </div>
          <FeedList items={wire} loading={loading} filter="all" />
        </section>
      </div>

      <footer className="mt-6 text-center text-mono text-ink-3">
        Live pulse: GDELT DOC 2.0 + Polity Layer 1 civic feed.
        {data && (
          <span>
            {" "}
            Tick #{data.heartbeat.tick} at{" "}
            {new Date(data.heartbeat.at).toLocaleTimeString()}.
          </span>
        )}
      </footer>
    </Shell>
  );
}
