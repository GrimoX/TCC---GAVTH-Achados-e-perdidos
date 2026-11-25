import { useState, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createItem, uploadPhoto, type ItemKind } from "../../lib/items";

interface ItemFormProps {
  kind: ItemKind;
  user: User;
  onClose: () => void;
  onCreated: () => void;
}

export default function ItemForm({ kind, user, onClose, onCreated }: ItemFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lost = kind === "lost";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3 || description.trim().length < 10) {
      setError("O título deve ter 3 caracteres e a descrição, pelo menos 10.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const photoPath = photo ? await uploadPhoto(photo, user.id) : null;
      await createItem(user.id, { type: kind, title: title.trim(), description: description.trim(), photoPath });
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível publicar o item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-sm">
      <section className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-9" aria-labelledby="form-title">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-6 top-6 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"><X size={20} /></button>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-forest">{lost ? "Item perdido" : "Item encontrado"}</p>
        <h2 id="form-title" className="mb-2 pr-8 text-2xl font-bold tracking-tight text-ink">{lost ? "Vamos encontrar juntos?" : "Ajude alguém a encontrar"}</h2>
        <p className="mb-7 text-sm leading-6 text-slate-500">Conte o que aconteceu. Evite incluir dados pessoais ou informações sensíveis.</p>
        <form onSubmit={submit} className="space-y-5">
          <label className="form-label">Título
            <input className="text-input" required minLength={3} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Garrafa térmica azul" />
          </label>
          <label className="form-label">Descrição
            <textarea className="text-input min-h-28 resize-y" required minLength={10} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={lost ? "Descreva onde e quando viu o item pela última vez..." : "Descreva o item e onde foi encontrado..."} />
          </label>
          <label className="form-label">Foto <span className="font-normal text-slate-400">(opcional, até 5 MB)</span>
            <span className="mt-1 flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-slate-300 px-5 py-4 transition hover:border-forest hover:bg-leaf/30">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-leaf text-forest"><ImagePlus size={21} /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{photo ? photo.name : "Escolher uma imagem"}</span><span className="mt-1 block text-xs text-slate-500">JPG, PNG ou WEBP</span></span>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="secondary-button justify-center">Cancelar</button>
            <button disabled={busy} className="primary-button justify-center disabled:opacity-60">{busy ? "Publicando..." : "Publicar item"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
