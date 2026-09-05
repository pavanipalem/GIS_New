import { apiRequest } from "./client";
import { tokenStore } from "./tokenStore";
import type { CurrentUser, TokenPair } from "../types/auth";

export async function login(username: string, password: string): Promise<TokenPair> {
  const pair = await apiRequest<TokenPair>("/auth/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
  tokenStore.set(pair.access_token, pair.refresh_token);
  return pair;
}

export function logout(): void {
  tokenStore.clear();
}

export function me(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/auth/me");
}

export function changePassword(current_password: string, new_password: string): Promise<void> {
  return apiRequest<void>("/auth/change-password", {
    method: "POST",
    body: { current_password, new_password },
  });
}
