import { withSupabase } from "@supabase/server";
import { handleMapleRequest } from "../maple-agent/index.ts";

// Deliberately separate from the authenticated account function.
export default { fetch: withSupabase({ auth: "none" }, (request, context) => handleMapleRequest(request, context, true)) };
