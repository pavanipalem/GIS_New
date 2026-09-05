import type { Role } from "./auth";

export interface UserOut {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UserCreated extends UserOut {
  temp_password: string | null;
}

export interface UserCreate {
  username: string;
  full_name?: string | null;
  role?: Role;
  is_active?: boolean;
  password?: string | null;
}

export interface UserUpdate {
  full_name?: string | null;
  role?: Role | null;
  is_active?: boolean | null;
}

export interface AdminResetPasswordResponse {
  temp_password: string;
}
