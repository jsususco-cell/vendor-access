import { resolveVendor, getAssignedJobs } from "@/lib/portal";
import PortalClient from "@/components/PortalClient";

export const dynamic = "force-dynamic";

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="center">
      <div className="card">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </div>
  );
}

export default async function VendorPortal({ params }: { params: { token: string } }) {
  let vendor = null;
  let error = false;
  try {
    vendor = await resolveVendor(params.token);
  } catch {
    error = true;
  }

  if (error)
    return <Centered title="Temporarily unavailable" body="We couldn't load your portal right now. Please try again shortly." />;
  if (!vendor)
    return (
      <Centered
        title="Link not recognized"
        body="This invite link is invalid or has been disabled. Please contact your Byrdson project manager for a new link."
      />
    );

  const jobs = await getAssignedJobs(vendor.recordId).catch(() => []);

  return (
    <div className="shell">
      <header className="site-header">
        <div className="logo">
          <svg className="shield" viewBox="0 0 100 116" xmlns="http://www.w3.org/2000/svg" aria-label="Byrdson shield">
            <path d="M50 4 L92 20 L92 60 C92 86 73 104 50 112 C27 104 8 86 8 60 L8 20 Z" fill="#ED2C20" stroke="#ffffff" strokeWidth="3" />
            <path d="M50 26 L74 44 L74 50 L68 50 L68 84 L32 84 L32 50 L26 50 L26 44 Z" fill="#ffffff" />
            <rect x="44" y="60" width="12" height="24" fill="#ED2C20" />
          </svg>
          <div>
            <div className="brandname">BYRDSON <span>SERVICES</span></div>
            <div className="brandsub">Excello Homes</div>
          </div>
        </div>
        <div className="htitle">
          <h1>Vendor Portal</h1>
          <div className="stamp">{vendor.company || vendor.name || "Vendor"}</div>
        </div>
      </header>

      <PortalClient token={params.token} vendor={vendor} jobs={jobs} />
    </div>
  );
}
