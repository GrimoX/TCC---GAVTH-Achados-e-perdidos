import AuthPanel from "./AuthPanel";

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-paper px-5 py-6 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-[0.16em] text-forest sm:text-5xl">GAVTH</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-sm">
            Achados &amp; Perdidos da Escola
          </p>
        </header>

        <div className="grid flex-1 items-center gap-5 pt-6 sm:gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pt-2">
          <div className="relative order-1 flex min-h-[300px] items-center justify-center sm:min-h-[390px] lg:min-h-[560px]">
            <div className="absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-sm font-bold text-forest shadow-lg sm:top-4 sm:px-6 sm:py-3.5 sm:text-base">
              Perdeu alguma coisa?
              <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-b border-r border-slate-100 bg-white" />
            </div>
            <img
              src="/gavth-login-mascot.png"
              alt="Guaxinim GAVTH segurando um guarda-chuva"
              className="mt-12 h-64 w-auto max-w-[90%] object-contain sm:h-[390px] lg:mt-16 lg:h-[500px]"
            />
          </div>

          <div className="order-2 flex justify-center pb-4 lg:pb-0">
            <AuthPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
