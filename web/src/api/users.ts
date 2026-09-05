import { get, patch, post } from "./client";
import type {
  AdminResetPasswordResponse,
  UserCreate,
  UserCreated,
  UserOut,
  UserUpdate,
} from "../types/user";

export const usersApi = {
  list: () => get<UserOut[]>("/users"),
  create: (data: UserCreate) => post<UserCreated>("/users", data),
  update: (id: number, data: UserUpdate) => patch<UserOut>(`/users/${id}`, data),
  resetPassword: (id: number) =>
    post<AdminResetPasswordResponse>(`/users/${id}/reset-password`),
};
