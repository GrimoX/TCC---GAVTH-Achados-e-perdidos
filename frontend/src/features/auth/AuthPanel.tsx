import { useState, type FormEvent } from "react";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configure as credenciais do Supabase para habilitar o acesso.");
      return;
    }
    if (password.length < 8) {
      setMessage("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Conta criada! Confira seu e-mail para confirmar o cadastro.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível acessar sua conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-[28px] border border-white bg-white p-7 shadow-card sm:p-9" aria-labelledby="auth-title">
        <div className="mb-7">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf text-forest">
            <KeyRound size={22} />
          </div>
          <h2 id="auth-title" className="text-2xl font-bold tracking-tight text-ink">
            {mode === "login" ? "Que bom ter você de volta" : "Crie sua conta"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login" ? "Entre para publicar e acompanhar itens." : "Use seu e-mail escolar para participar."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <label className="form-label">
              Nome
              <span className="input-wrap"><UserRound size={18} /><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Como podemos chamar você?" /></span>
            </label>
          )}
          <label className="form-label">
            E-mail
            <span className="input-wrap"><Mail size={18} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="voce@escola.com" /></span>
          </label>
          <label className="form-label">
            Senha
            <span className="input-wrap"><KeyRound size={18} /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" minLength={8} /></span>
          </label>
          {message && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p>}
          <button disabled={busy} className="primary-button w-full justify-center py-3.5 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === "login" ? "Ainda não tem uma conta?" : "Já tem uma conta?"}{" "}
          <button className="font-semibold text-forest hover:underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
            {mode === "login" ? "Cadastre-se" : "Fazer login"}
          </button>
        </p>
      </section>
  );
}
