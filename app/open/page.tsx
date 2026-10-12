export default async function OpenPage({ searchParams }: { searchParams: Promise<{ error?: string; session?: string; invite?: string }> }) {
  const params = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <p className="serif text-4xl text-pine">Rent Right</p>
      <h1 className="mt-4 text-3xl">Open the phone app</h1>
      {params.error && <p className="note-clay mt-4" role="alert">{params.error}</p>}
      {params.session && (
        <p className="note-pine mt-4 text-sm">Signed in. If the app did not open, paste this code on the welcome screen.</p>
      )}
      {params.session && <p className="card mt-3 break-all p-4 text-xs">{params.session}</p>}
      {params.invite && <p className="mt-4 text-sm">Roommate code: {params.invite}</p>}
      {!params.error && !params.session && <p className="mt-4 text-mute">Rent Right runs in Expo Go or a simulator. The server on this address stores your records.</p>}
    </main>
  );
}
