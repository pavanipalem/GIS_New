import { apiRequest, get } from "./client";
import type {
  LineDetail,
  LineFields,
  LinePage,
  TowerFields,
  TowerOut,
  TowerPage,
} from "../types/network";

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string | number)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const linesApi = {
  list: (p: { q?: string; volt_class?: string; zone?: string; limit?: number; offset?: number } = {}) =>
    get<LinePage>(`/lines${qs({ ...p })}`),
  get: (feederId: number) => get<LineDetail>(`/lines/${feederId}`),
  create: (data: LineFields) =>
    apiRequest<LineDetail>("/lines", { method: "POST", body: data }),
  update: (feederId: number, data: Partial<LineFields>) =>
    apiRequest<LineDetail>(`/lines/${feederId}`, { method: "PUT", body: data }),
};

export const towersApi = {
  list: (p: { feeder_id?: number; q?: string; limit?: number; offset?: number } = {}) =>
    get<TowerPage>(`/towers${qs({ ...p })}`),
  get: (towerId: number) => get<TowerOut>(`/towers/${towerId}`),
  create: (data: TowerFields & { feeder_id: number }) =>
    apiRequest<TowerOut>("/towers", { method: "POST", body: data }),
  update: (towerId: number, data: Partial<TowerFields> & { feeder_id?: number }) =>
    apiRequest<TowerOut>(`/towers/${towerId}`, { method: "PUT", body: data }),
  remove: (towerId: number) =>
    apiRequest<void>(`/towers/${towerId}`, { method: "DELETE" }),
};
