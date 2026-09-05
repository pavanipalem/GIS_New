export type Role = "admin" | "editor" | "viewer";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password: boolean;
}

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  must_change_password: boolean;
}
