import { apiRequest, get } from "./client";
import type {
  EhvConsumerFields,
  EhvConsumerOut,
  SolarPlantFields,
  SolarPlantOut,
} from "../types/assets";

export const solarApi = {
  list: () => get<SolarPlantOut[]>("/solar-plants"),
  create: (data: SolarPlantFields) =>
    apiRequest<SolarPlantOut>("/solar-plants", { method: "POST", body: data }),
  update: (id: number, data: Partial<SolarPlantFields>) =>
    apiRequest<SolarPlantOut>(`/solar-plants/${id}`, { method: "PUT", body: data }),
  remove: (id: number) => apiRequest<void>(`/solar-plants/${id}`, { method: "DELETE" }),
};

export const ehvApi = {
  list: () => get<EhvConsumerOut[]>("/ehv-consumers"),
  create: (data: EhvConsumerFields) =>
    apiRequest<EhvConsumerOut>("/ehv-consumers", { method: "POST", body: data }),
  update: (id: number, data: Partial<EhvConsumerFields>) =>
    apiRequest<EhvConsumerOut>(`/ehv-consumers/${id}`, { method: "PUT", body: data }),
  remove: (id: number) => apiRequest<void>(`/ehv-consumers/${id}`, { method: "DELETE" }),
};
