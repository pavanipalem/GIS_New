import { mapApi } from "../../api/map";
import { useLayerData } from "./useLayerData";
import { LineLayer } from "./LineLayer";
import type { LineFeature } from "../../types/map";

/** One component instance per voltage class - see SubstationLayerGroup for
 * why the hook lives here rather than in a loop in MapPage.
 *
 * `underground` selects the UG Cables layers. In the legacy code those were
 * the same lines table filtered by a hardcoded list of feeder ids repeated
 * across five stored procedures; migration 0009 turned that list into
 * gis.line.is_underground, so here it is one more filter on the same
 * endpoint.
 *
 * The From/To filter is applied client side: the layer's rows are already in
 * memory (602 lines at most) and filtering here keeps the fetch-once cache in
 * useLayerData intact, so changing the dropdown does not re-hit the API.
 */
export function LineLayerGroup({
  voltClass,
  enabled,
  color,
  underground = false,
  fromSubstation = "",
  toSubstation = "",
}: {
  voltClass: string;
  enabled: boolean;
  color: string;
  underground?: boolean;
  fromSubstation?: string;
  toSubstation?: string;
}) {
  const { data } = useLayerData<LineFeature>(enabled, () =>
    mapApi.lines(voltClass, underground ? true : undefined)
  );
  if (!enabled || !data) return null;

  const lines = data.filter(
    (l) =>
      (!fromSubstation || l.from_substation === fromSubstation) &&
      (!toSubstation || l.to_substation === toSubstation)
  );

  return <LineLayer lines={lines} color={color} />;
}
