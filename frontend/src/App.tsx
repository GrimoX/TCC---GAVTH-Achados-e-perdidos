import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, ArrowRight, Bell, Box, Check, ChevronDown, CircleHelp, HandHeart, LogOut, Mail, MapPin, Plus, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import LoginPage from "./features/auth/LoginPage";
import ItemForm from "./features/items/ItemForm";
import {
  fetchInterests,
  fetchItems,
  fetchUserRole,
  getDisplayName,
  softDeleteItem,
  setItemInterest,
  setItemStatus,
  type Item,
  type ItemInterest,
  type ItemKind,
  type ItemStatus,
  type UserRole,
} from "./lib/items";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Filter = "all" | ItemKind;

const samples: Item[] = [
  { id: "sample-1", type: "found", title: "Estojo verde com canetas", description: "Encontrei no corredor do bloco B, perto da biblioteca. Está com algumas canetas coloridas dentro.", photoUrl: null, createdAt: new Date().toISOString(), status: "active" },
  { id: "sample-2", type: "lost", title: "Garrafa térmica azul", description: "Acho que esqueci no laboratório de ciências depois da aula da manhã. Tem uma pequena estrela adesivada.", photoUrl: null, createdAt: new Date(Date.now() - 86400000).toISOString(), status: "active" },
  { id: "sample-3", type: "found", title: "Chaveiro de ursinho", description: "Estava no pátio perto das mesas. Deixei na secretaria para retirada.", photoUrl: null, createdAt: new Date(Date.now() - 172800000).toISOString(), status: "active" },
];

function formatStoryDate(date: string): string {
  const created = new Date(date);
  const today = new Date();
  const days = Math.floor((today.getTime() - created.getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return created.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [role, setRole] = useState<UserRole>("student");
  const [roleLoading, setRoleLoading] = useState(false);
  const [interests, setInterests] = useState<ItemInterest[]>([]);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [formKind, setFormKind] = useState<ItemKind | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>(samples);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      if (sessionError) setError("Não foi possível verificar sua sessão. Entre novamente.");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRole("student");
      setRoleLoading(false);
      setInterests([]);
      return () => { active = false; };
    }
    const activeUser = user;
    setRole("student");
    setRoleLoading(true);
    setInterests([]);

    async function loadAccessData() {
      let nextRole: UserRole = "student";
      try {
        nextRole = await fetchUserRole();
        if (active) {
          setRole(nextRole);
          setRoleLoading(false);
        }
        const nextInterests = await fetchInterests(activeUser.id, nextRole);
        if (active) {
          setInterests(nextInterests);
        }
      } catch (accessError) {
        if (active) {
          setRole(nextRole);
          setRoleLoading(false);
          setError(accessError instanceof Error ? accessError.message : "Não foi possível carregar os dados do perfil.");
        }
      }
    }

    void loadAccessData();
    return () => { active = false; };
  }, [user]);

  const loadItems = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    try {
      setItems(await fetchItems(search, filter));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os itens.");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadItems(); }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadItems]);

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError("Não foi possível sair da conta.");
  }

  async function toggleInterest(item: Item) {
    if (!user) return;
    const alreadyInterested = interests.some((interest) => interest.itemId === item.id && interest.userId === user.id);
    setBusyItemId(item.id);
    setError("");
    try {
      await setItemInterest(item.id, user.id, getDisplayName(user), alreadyInterested);
      setInterests(await fetchInterests(user.id, role));
      setNotice(alreadyInterested ? "Interesse removido." : "Interesse registrado. A Secretaria verá seu nome.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (interestError) {
      setError(interestError instanceof Error ? interestError.message : "Não foi possível atualizar seu interesse.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function updateStatus(item: Item, status: Exclude<ItemStatus, "active" | "removed">) {
    setBusyItemId(item.id);
    setError("");
    try {
      await setItemStatus(item.id, status);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
      setNotice(status === "found" ? "Item marcado como encontrado." : "Item marcado como devolvido.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Não foi possível atualizar o estado do item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(item: Item) {
    if (!window.confirm(`Deseja remover "${item.title}" do mural? O registro será preservado no banco.`)) return;
    setBusyItemId(item.id);
    setError("");
    try {
      await softDeleteItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setInterests((current) => current.filter((interest) => interest.itemId !== item.id));
      setNotice("Item removido do mural. O registro foi preservado no histórico.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o item.");
    } finally {
      setBusyItemId(null);
    }
  }

  function finishCreate() {
    setFormKind(null);
    setNotice("Item publicado com sucesso!");
    window.setTimeout(() => setNotice(""), 3500);
    void loadItems();
  }

  const visibleItems = isSupabaseConfigured
    ? items
    : samples.filter((item) =>
        (filter === "all" || item.type === filter) &&
        (!search.trim() || `${item.title} ${item.description}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))),
      );

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fde8d5] text-sm font-medium text-slate-500">
        Carregando GAVTH...
      </main>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-[#fde8d5] text-ink">
      <header className="sticky top-0 z-20 border-b border-ink/5 bg-[#fde8d5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="GAVTH, Achados e Perdidos da escola">
            <img src="/gavth-logo.png" alt="Mascote GAVTH" className="h-12 w-20 object-contain" />
            <span className="text-[15px] font-bold leading-tight tracking-tight">GAVTH<span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Achados & Perdidos da Escola</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            <a href="#itens" className="text-ink">Explorar itens</a>
            <a href="#como-funciona" className="transition hover:text-ink">Como funciona</a>
            <a href="#contatos" className="transition hover:text-ink">Contatos</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                {!roleLoading && <span className="hidden rounded-full bg-leaf px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-forest sm:inline">
                  {role === "secretary" ? "Secretaria" : "Aluno"}
                </span>}
                <span className="hidden max-w-32 truncate text-sm font-medium text-slate-600 sm:inline">{getDisplayName(user)}</span>
                <button onClick={() => void signOut()} title="Sair" aria-label="Sair" className="icon-button"><LogOut size={18} /></button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-36 -top-32 h-[440px] w-[440px] rounded-full bg-[#e6eee2] blur-2xl" />
          <div className="pointer-events-none absolute right-[17%] top-44 h-32 w-32 rounded-full bg-[#f1e9d8]/60 blur-2xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:pb-20 lg:pt-20">
            <div className="max-w-2xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-3.5 py-2 text-xs font-semibold text-forest shadow-sm"><Sparkles size={14} /> Um pouquinho de cuidado faz diferença</span>
              <h1 className="max-w-[650px] text-[42px] font-bold leading-[1.08] tracking-[-0.045em] text-ink sm:text-6xl lg:text-[68px]">O que se perde, a gente <span className="text-forest">encontra junto.</span></h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">Um espaço simples para dar uma segunda chance aos objetos perdidos na nossa escola.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => setFormKind("lost")} className="primary-button">Perdi um item <ArrowRight size={17} /></button>
                <button onClick={() => setFormKind("found")} className="secondary-button">Encontrei algo <HandHeart size={17} /></button>
              </div>
              <div className="mt-9 flex items-center gap-3 text-sm text-slate-400"><span className="flex -space-x-2"><span className="avatar-dot bg-[#d6e5d2]">✦</span><span className="avatar-dot bg-[#f0dfc7]">♡</span><span className="avatar-dot bg-[#dce4ef]">✓</span></span><span>Uma comunidade que cuida do que é nosso</span></div>
            </div>
            <div className="relative mx-auto w-full max-w-[500px] lg:ml-auto">
              <div className="rounded-[30px] border border-white/80 bg-white/75 p-4 shadow-card backdrop-blur-sm sm:p-5">
                <div className="flex items-center justify-between px-1 pb-4">
                  <div><p className="text-sm font-bold text-ink">Pequenos reencontros</p><p className="mt-1 text-xs text-slate-400">A comunidade fazendo a diferença</p></div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff5eb] text-forest"><Bell size={17} /></span>
                </div>
                <div className="space-y-3">
                  {(isSupabaseConfigured ? items : samples).slice(0, 3).map((item, storyIndex) => {
                    const statusLabel = item.status === "returned"
                      ? "DEVOLVIDO"
                      : item.status === "found"
                        ? "PEDIDO RESGATADO"
                        : "AGUARDANDO";
                    const statusStyle = item.status === "active"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-[#edf4eb] text-forest";
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white p-3.5">
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] text-2xl ${["bg-[#f3eee3]", "bg-[#e6efe4]", "bg-[#e9edf4]"][storyIndex % 3]}`}>
                          {item.type === "lost" ? "🔎" : "📦"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">{item.title}</span>
                          <span className="mt-1 block text-xs text-slate-400">{formatStoryDate(item.createdAt)}</span>
                        </span>
                        <span className={`hidden max-w-28 rounded-full px-2.5 py-1 text-center text-[9px] font-bold leading-3 tracking-wider sm:inline ${statusStyle}`}>{statusLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#f5f7f3] py-3 text-xs font-medium text-slate-500"><Check size={14} className="text-forest" /> Cada item tem uma história. Vamos ajudar.</div>
              </div>
              <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-card sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5ecde] text-xl">💛</span><span><span className="block text-xs font-bold text-ink">Feito pela comunidade</span><span className="mt-1 block text-[10px] text-slate-400">Um gesto de cada vez</span></span></div>
            </div>
          </div>
        </section>

        <section id="itens" className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 sm:pt-12">
          <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-forest">Mural da escola</p><h2 className="text-3xl font-bold tracking-tight text-ink sm:text-[38px]">Vamos procurar?</h2><p className="mt-2 text-sm text-slate-500">Talvez o que você procura já esteja por aqui.</p></div>
            <button onClick={() => setFormKind("found")} className="secondary-button self-start sm:self-auto"><Plus size={17} /> Publicar um achado</button>
          </div>
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
            <label className="flex min-h-11 flex-1 items-center gap-3 px-2 sm:px-3"><Search size={19} className="shrink-0 text-slate-400" /><span className="sr-only">Buscar itens</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou descrição..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" /></label>
            <div className="flex gap-2 overflow-x-auto sm:border-l sm:border-slate-100 sm:pl-3">
              {([{ id: "all", text: "Todos" }, { id: "lost", text: "Perdidos" }, { id: "found", text: "Encontrados" }] as const).map((option) => <button key={option.id} onClick={() => setFilter(option.id)} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${filter === option.id ? "bg-forest text-white" : "bg-slate-50 text-slate-500 hover:bg-leaf hover:text-forest"}`}>{option.text}</button>)}
            </div>
          </div>
          {error && <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={17} />{error}</div>}
          {notice && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl bg-[#edf4eb] p-4 text-sm text-forest"><Check size={17} />{notice}</div>}
          {loading && <p className="py-12 text-center text-sm text-slate-400">Carregando itens...</p>}
          {!loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item, index) => {
                const itemInterests = interests.filter((interest) => interest.itemId === item.id);
                const alreadyInterested = Boolean(user && itemInterests.some((interest) => interest.userId === user.id));
                const secretaryAction: Exclude<ItemStatus, "active" | "removed"> | null = item.status === "returned" || item.status === "removed"
                  ? null
                  : item.type === "lost" && item.status === "active"
                    ? "found"
                    : "returned";

                return <article key={item.id} className="group overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-card">
                  <div className={`relative flex h-36 items-center justify-center ${item.photoUrl ? "bg-slate-100" : ["bg-[#edf2e8]", "bg-[#f5efe5]", "bg-[#e9edf4]"][index % 3]}`}>
                    {item.photoUrl ? <img src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" /> : <span className="text-5xl opacity-80">{item.type === "lost" ? "🔎" : "📦"}</span>}
                    <span className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${item.type === "lost" ? "bg-amber-50 text-amber-800" : "bg-white text-forest"}`}>{item.type === "lost" ? "Perdido" : "Encontrado"}</span>
                    {item.status !== "active" && <span className="absolute right-4 top-4 rounded-full bg-forest px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">{item.status === "found" ? "Pedido Resgatado" : "Devolvido"}</span>}
                  </div>
                  <div className="p-5">
                    <div className="mb-2 flex items-start justify-between gap-3"><h3 className="text-[16px] font-bold text-ink">{item.title}</h3><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8aae7e]" /></div>
                    {expandedDescriptions.has(item.id) ? (
                      <p className="text-sm leading-5 text-slate-500">{item.description}</p>
                    ) : (
                      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{item.description}</p>
                    )}
                    {item.description.length > 95 && (
                      <button
                        type="button"
                        onClick={() => setExpandedDescriptions((current) => {
                          const next = new Set(current);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })}
                        className="mt-1 text-xs font-bold text-forest hover:underline"
                        aria-expanded={expandedDescriptions.has(item.id)}
                      >
                        {expandedDescriptions.has(item.id) ? "Mostrar menos" : "Ler descrição completa"}
                      </button>
                    )}
                    {role === "secretary" && itemInterests.length > 0 && <p className="mt-3 rounded-xl bg-[#f3f6f1] px-3 py-2 text-xs text-forest"><strong>Interessados:</strong> {itemInterests.map((interest) => interest.displayName).join(", ")}</p>}
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
                      {role === "secretary" ? (
                        <div className="flex items-center gap-3">
                          {secretaryAction ? <button disabled={busyItemId === item.id} onClick={() => void updateStatus(item, secretaryAction)} className="inline-flex items-center gap-1 text-right text-xs font-bold text-forest hover:underline disabled:opacity-50">
                            {secretaryAction === "found" ? "Marcar encontrado" : "Marcar devolvido"}
                          </button> : <span className="text-xs font-semibold text-slate-400">Finalizado</span>}
                          <button
                            type="button"
                            disabled={busyItemId === item.id}
                            onClick={() => void removeItem(item)}
                            aria-label={`Excluir ${item.title}`}
                            title="Excluir item"
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
                          >
                            <Trash2 size={14} /> Remover
                          </button>
                        </div>
                      ) : (
                        <button disabled={busyItemId === item.id || item.status === "returned"} onClick={() => void toggleInterest(item)} className="inline-flex items-center gap-1 text-right text-xs font-bold text-forest hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                          {item.status === "returned" ? "Devolvido" : alreadyInterested ? "Remover interesse" : "Tenho interesse"}
                          {item.status !== "returned" && <ArrowRight size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </article>;
              })}
            </div>
          )}
          {!loading && visibleItems.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 py-16 text-center"><Box className="mx-auto text-slate-300" size={30} /><p className="mt-3 font-semibold text-ink">Nenhum item por aqui ainda</p><p className="mt-1 text-sm text-slate-500">Tente mudar a busca ou os filtros.</p></div>}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"><CircleHelp size={15} /> Achou algo? Entregue também na secretaria da escola.</div>
        </section>

        <section id="como-funciona" className="border-t border-[#eccfb8] bg-[#fde8d5]/55">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:items-center md:py-16">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-forest">Simples assim</p><h2 className="text-3xl font-bold tracking-tight">Um caminho de volta para cada coisa.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">Pequenos passos para cuidar do que importa e fortalecer nossa comunidade.</p><a href="#contatos" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:underline">Ver como funciona <ArrowRight size={15} /></a></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[{ n: "01", title: "Publique", text: "Descreva o que perdeu ou encontrou.", icon: <Plus size={18} /> }, { n: "02", title: "Procure", text: "Use a busca para explorar o mural.", icon: <Search size={18} /> }, { n: "03", title: "Reencontre", text: "Combine a retirada com a secretaria.", icon: <HandHeart size={18} /> }].map((step) => <div key={step.n} className="rounded-2xl border border-slate-100 bg-white p-5"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf text-forest">{step.icon}</span><span className="text-xs font-bold text-slate-300">{step.n}</span></div><h3 className="mt-5 font-bold">{step.title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{step.text}</p></div>)}
            </div>
          </div>
        </section>

        <footer id="contatos" className="border-t border-[#eccfb8] bg-[#fff7ef]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3 md:gap-10 md:py-14">
            <div>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-forest"><Mail size={16} /> Contato</div>
              <a href="tel:+551125467799" className="text-lg font-bold text-ink hover:text-forest">(11) 2546-7799</a>
            </div>
            <div>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-forest"><MapPin size={16} /> Localização</div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Rua%20Boaventura%20Rodrigues%20da%20Silva%2C%201000%20-%20Parque%20Boturussu"
                target="_blank"
                rel="noreferrer"
                className="block max-w-xs text-sm leading-6 text-slate-600 hover:text-forest"
              >
                Rua Boaventura Rodrigues da Silva, 1000 - Parque Boturussu
              </a>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-forest">Créditos do Site</p>
              <ul className="space-y-1.5 text-sm leading-5 text-slate-600">
                <li>Gabriel Ramos Caldeira da Silva</li>
                <li>Vinicius Teixeira da Silva</li>
                <li>Agatha Estefani Galdino De Oliveira</li>
                <li>Thiago Martins Rodrigues</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#eccfb8] px-5 py-5 text-center text-xs text-slate-500">
            Feito com cuidado para a comunidade escolar <span className="px-1 text-rose-300">♥</span>
          </div>
        </footer>
      </main>

      {formKind && user && <ItemForm kind={formKind} user={user} onClose={() => setFormKind(null)} onCreated={finishCreate} />}
    </div>
  );
}

export default App;
