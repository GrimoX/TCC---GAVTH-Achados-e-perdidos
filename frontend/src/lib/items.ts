import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

export type ItemKind = "lost" | "found";
export type ItemStatus = "active" | "found" | "returned";
export type UserRole = "student" | "secretary";

export interface Item {
  id: string;
  type: ItemKind;
  title: string;
  description: string;
  photoUrl: string | null;
  createdAt: string;
  status: ItemStatus;
}

export interface ItemInterest {
  itemId: string;
  userId: string;
  displayName: string;
  createdAt: string;
}

interface ItemRow {
  id: string;
  type: ItemKind;
  title: string;
  description: string;
  photo_path: string | null;
  created_at: string;
  status: ItemStatus;
}

const bucket = "lost-found-images";

export function getDisplayName(user: User): string {
  const metadata = user.user_metadata;
  const value = metadata.display_name || metadata.full_name || metadata.name || user.email?.split("@")[0];
  return String(value || "Aluno").trim().slice(0, 80) || "Aluno";
}

export async function uploadPhoto(file: File, userId: string): Promise<string> {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("Não foi possível enviar a foto. Verifique a configuração do Storage.");
  return path;
}

export async function fetchItems(search: string, type: string): Promise<Item[]> {
  const client = supabase;
  if (!client) throw new Error("O Supabase não está configurado.");

  const { data, error } = await client
    .from("items")
    .select("id,type,title,description,photo_path,created_at,status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Não foi possível carregar os itens. Verifique se o schema foi executado no Supabase.");

  const term = search.trim().toLocaleLowerCase("pt-BR");
  return ((data ?? []) as ItemRow[])
    .filter((item) =>
      (type === "all" || item.type === type) &&
      (!term || `${item.title} ${item.description}`.toLocaleLowerCase("pt-BR").includes(term)),
    )
    .map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      photoUrl: item.photo_path
        ? client.storage.from(bucket).getPublicUrl(item.photo_path).data.publicUrl
        : null,
      createdAt: item.created_at,
      status: item.status,
    }));
}

export async function fetchUserRole(): Promise<UserRole> {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  const { data, error } = await supabase.rpc("is_secretary");
  if (error) throw new Error(`Não foi possível carregar o perfil (${error.code}): ${error.message}`);
  return data === true ? "secretary" : "student";
}

export async function fetchInterests(userId: string, role: UserRole): Promise<ItemInterest[]> {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  let query = supabase
    .from("item_interests")
    .select("item_id,user_id,display_name,created_at")
    .order("created_at", { ascending: true });
  if (role === "student") query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os interesses. Execute o schema atualizado do Supabase.");
  return (data ?? []).map((interest) => ({
    itemId: interest.item_id,
    userId: interest.user_id,
    displayName: interest.display_name,
    createdAt: interest.created_at,
  }));
}

export async function setItemInterest(
  itemId: string,
  userId: string,
  displayName: string,
  interested: boolean,
): Promise<void> {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  const result = interested
    ? await supabase.from("item_interests").delete().eq("item_id", itemId).eq("user_id", userId)
    : await supabase.from("item_interests").insert({
        item_id: itemId,
        user_id: userId,
        display_name: displayName.trim().slice(0, 80) || "Aluno",
      });
  if (result.error) throw new Error(`Não foi possível atualizar seu interesse (${result.error.code}): ${result.error.message}`);
}

export async function setItemStatus(itemId: string, status: Exclude<ItemStatus, "active">): Promise<void> {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  const { error } = await supabase.rpc("set_item_status", {
    target_item: itemId,
    next_status: status,
  });
  if (error) throw new Error(`Não foi possível atualizar o estado do item (${error.code}): ${error.message}`);
}

export async function createItem(
  userId: string,
  input: { type: ItemKind; title: string; description: string; photoPath: string | null },
): Promise<void> {
  if (!supabase) throw new Error("O Supabase não está configurado.");
  const { error } = await supabase.from("items").insert({
    user_id: userId,
    type: input.type,
    title: input.title,
    description: input.description,
    photo_path: input.photoPath,
  });
  if (error) throw new Error("Não foi possível publicar o item. Entre novamente e tente outra vez.");
}
