import { apiRequest, get } from "./client";
import type {
  SubstationCreate,
  SubstationDetail,
  SubstationListParams,
  SubstationPage,
  SubstationWrite,
} from "../types/substation";

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string | number)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const substationsApi = {
  list: (params: SubstationListParams = {}) =>
    get<SubstationPage>(`/substations${qs({ ...params })}`),
  get: (ssCode: number) => get<SubstationDetail>(`/substations/${ssCode}`),
  create: (data: SubstationCreate) =>
    apiRequest<SubstationDetail>("/substations", { method: "POST", body: data }),
  update: (ssCode: number, data: SubstationWrite) =>
    apiRequest<SubstationDetail>(`/substations/${ssCode}`, { method: "PUT", body: data }),
};
