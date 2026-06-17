import { redirect } from "react-router"

import { ROUTE_ENTRY_PENDING, ROUTE_VIEW_ALL } from "~/constants"
import { SMART_FEED_TODAY } from "~/lib/timeline-scope"

export function Component() {
  return null
}

export const loader = () => {
  return redirect(`/timeline/${ROUTE_VIEW_ALL}/${SMART_FEED_TODAY}/${ROUTE_ENTRY_PENDING}`)
}
