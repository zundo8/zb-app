import fs from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "lib", "ai-settings.json");

export interface AISettings {
  enabledTools: string[];
  allowedPages: string[];
  restrictToOwnData?: boolean;
}

export interface TrainingRule {
  id: string;
  prompt: string;
  createdAt: string;
}

export interface ZicaAISettings {
  admin: AISettings;
  user: AISettings;
  trainingRules?: TrainingRule[];
}

export function getAISettings(): ZicaAISettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[ai-settings] Failed to read settings:", err);
  }
  
  // Return fallback default values
  return {
    admin: {
      enabledTools: [
        "get_dashboard_summary", "generate_daily_briefing", "get_production_batches",
        "advance_production_stage", "get_pending_tasks", "create_task", "update_task_status",
        "get_fabric_inventory", "get_low_stock_products", "create_reorder_request",
        "get_orders_summary", "update_order_status", "get_returns_exchanges", "get_vendors",
        "get_cost_ledger", "send_push_notification", "send_email_notification",
        "get_payment_details", "get_shipment_details", "get_ai_action_log", "get_app_user_chats"
      ],
      allowedPages: ["dashboard", "manufacturing", "inventory", "orders", "customers", "marketing", "settings", "webhooks"]
    },
    user: {
      enabledTools: ["get_shipment_details", "get_payment_details", "get_orders_summary"],
      allowedPages: ["shop", "collections", "cart", "orders", "profile", "support"],
      restrictToOwnData: true
    },
    trainingRules: []
  };
}

export function saveAISettings(settings: ZicaAISettings): boolean {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[ai-settings] Failed to write settings:", err);
    return false;
  }
}
