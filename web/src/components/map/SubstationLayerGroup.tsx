import { mapApi } from "../../api/map";
import { useLayerData } from "./useLayerData";
import { PointLayer } from "./PointLayer";
import type { SubstationMarker } from "../../types/map";

/** One component instance per voltage class, so useLayerData is called once
 * per component rather than in a loop. Keeps the hook call order stable even
 * if the voltage-class list later becomes dynamic (e.g. driven by
 * /api/map/substations/summary). */
export function SubstationLayerGroup({
  voltClass,
  enabled,
  color,
}: {
  voltClass: string;
  enabled: boolean;
  color: string;
}) {
  const { data } = useLayerData<SubstationMarker>(enabled, () => mapApi.substations(voltClass));
  if (!enabled || !data) return null;

  return (
    <PointLayer
      points={data}
      color={color}
      keyOf={(s) => s.ss_code}
      popupContent={(s) => (
        <>
          <strong>{s.ss_name}</strong> ({s.volt_class} kV, {s.ss_type})
          <br />
          PTRs: {s.no_of_ptrs ?? "-"}
          {s.ss_doc && (
            <>
              <br />
              Commissioned: {s.ss_doc}
            </>
          )}
        </>
      )}
    />
  );
}
