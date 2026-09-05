import { mapApi } from "../../api/map";
import { useLayerData } from "./useLayerData";
import { LineLayer } from "./LineLayer";
import type { LineFeature } from "../../types/map";

/** One component instance per voltage class - see SubstationLayerGroup for
 * why the hook lives here rather than in a loop in MapPage. */
export function LineLayerGroup({
  voltClass,
  enabled,
  color,
}: {
  voltClass: string;
  enabled: boolean;
  color: string;
}) {
  const { data } = useLayerData<LineFeature>(enabled, () => mapApi.lines(voltClass));
  if (!enabled || !data) return null;

  return <LineLayer lines={data} color={color} />;
}
