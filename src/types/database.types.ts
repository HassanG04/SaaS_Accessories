
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"actor_role": string,"at": string,"entity": string,"entity_id": string,"id": number,"new": Json | null,"old": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"actor_role": string,"at"?: string,"entity": string,"entity_id": string,"id"?: never,"new"?: Json | null,"old"?: Json | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"actor_role"?: string,"at"?: string,"entity"?: string,"entity_id"?: string,"id"?: never,"new"?: Json | null,"old"?: Json | null
                  }
                  Relationships: [

                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": number,"image_url": string | null,"is_active": boolean,"name": string,"name_ar": string | null,"show_on_home": boolean,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"image_url"?: string | null,"is_active"?: boolean,"name": string,"name_ar"?: string | null,"show_on_home"?: boolean,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"image_url"?: string | null,"is_active"?: boolean,"name"?: string,"name_ar"?: string | null,"show_on_home"?: boolean,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [

                  ]
                },"delivery_fees": {
                  Row: {
                    "fee": number,"governorate_id": number,"method": Database["public"]['Enums']["delivery_method"]
                  }
                  ComputedFields: never
                  Insert: {
                    "fee": number,"governorate_id": number,"method": Database["public"]['Enums']["delivery_method"]
                  }
                  Update: {
                    "fee"?: number,"governorate_id"?: number,"method"?: Database["public"]['Enums']["delivery_method"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_fees_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"product_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "customer_stats"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"governorates": {
                  Row: {
                    "id": number,"name_ar": string,"name_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": number,"name_ar": string,"name_en": string
                  }
                  Update: {
                    "id"?: number,"name_ar"?: string,"name_en"?: string
                  }
                  Relationships: [

                  ]
                },"order_items": {
                  Row: {
                    "id": number,"order_id": number,"product_id": number,"product_name": string,"quantity": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"order_id": number,"product_id": number,"product_name": string,"quantity": number,"unit_price": number
                  }
                  Update: {
                    "id"?: never,"order_id"?: number,"product_id"?: number,"product_name"?: string,"quantity"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"delivery_method": Database["public"]['Enums']["delivery_method"],"id": number,"notes": string | null,"paid_at": string | null,"payment_deadline": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"payment_proof_path": string | null,"payment_reference": string | null,"payment_review_note": string | null,"payment_reviewed_by": string | null,"payment_status": Database["public"]['Enums']["payment_status"],"payment_submitted_at": string | null,"rep_name": string | null,"rep_phone": string | null,"ship_address": string,"ship_alt_phone": string | null,"ship_apartment": string | null,"ship_city": string | null,"ship_district": string | null,"ship_floor": string | null,"ship_governorate": string,"ship_landmark": string | null,"ship_name": string,"ship_phone": string,"ship_postal_code": string,"shipping_fee": number,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"tracking_number": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delivery_method": Database["public"]['Enums']["delivery_method"],"id"?: never,"notes"?: string | null,"paid_at"?: string | null,"payment_deadline"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_proof_path"?: string | null,"payment_reference"?: string | null,"payment_review_note"?: string | null,"payment_reviewed_by"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"payment_submitted_at"?: string | null,"rep_name"?: string | null,"rep_phone"?: string | null,"ship_address": string,"ship_alt_phone"?: string | null,"ship_apartment"?: string | null,"ship_city"?: string | null,"ship_district"?: string | null,"ship_floor"?: string | null,"ship_governorate": string,"ship_landmark"?: string | null,"ship_name": string,"ship_phone": string,"ship_postal_code": string,"shipping_fee": number,"status"?: Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"tracking_number"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"delivery_method"?: Database["public"]['Enums']["delivery_method"],"id"?: never,"notes"?: string | null,"paid_at"?: string | null,"payment_deadline"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_proof_path"?: string | null,"payment_reference"?: string | null,"payment_review_note"?: string | null,"payment_reviewed_by"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"payment_submitted_at"?: string | null,"rep_name"?: string | null,"rep_phone"?: string | null,"ship_address"?: string,"ship_alt_phone"?: string | null,"ship_apartment"?: string | null,"ship_city"?: string | null,"ship_district"?: string | null,"ship_floor"?: string | null,"ship_governorate"?: string,"ship_landmark"?: string | null,"ship_name"?: string,"ship_phone"?: string,"ship_postal_code"?: string,"shipping_fee"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"tracking_number"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "customer_stats"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_reviews": {
                  Row: {
                    "comment": string,"created_at": string,"id": number,"is_verified_purchase": boolean,"product_id": number,"rating": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment": string,"created_at"?: string,"id"?: never,"is_verified_purchase"?: boolean,"product_id": number,"rating": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "comment"?: string,"created_at"?: string,"id"?: never,"is_verified_purchase"?: boolean,"product_id"?: number,"rating"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "customer_stats"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "product_reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_id": number,"created_at": string,"description": string | null,"description_ar": string | null,"discount_percent": number,"extra_images": (string)[],"final_price": number | null,"id": number,"image_url": string | null,"in_stock": boolean | null,"is_active": boolean,"is_featured": boolean,"name": string,"name_ar": string | null,"price": number,"sold_count": number,"stock_quantity": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"created_at"?: string,"description"?: string | null,"description_ar"?: string | null,"discount_percent"?: number,"extra_images"?: (string)[],"final_price"?: never,"id"?: number,"image_url"?: string | null,"in_stock"?: never,"is_active"?: boolean,"is_featured"?: boolean,"name": string,"name_ar"?: string | null,"price": number,"sold_count"?: number,"stock_quantity"?: number,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: number,"created_at"?: string,"description"?: string | null,"description_ar"?: string | null,"discount_percent"?: number,"extra_images"?: (string)[],"final_price"?: never,"id"?: number,"image_url"?: string | null,"in_stock"?: never,"is_active"?: boolean,"is_featured"?: boolean,"name"?: string,"name_ar"?: string | null,"price"?: number,"sold_count"?: number,"stock_quantity"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "address": string | null,"alt_phone": string | null,"apartment": string | null,"banned_at": string | null,"banned_reason": string | null,"city": string | null,"created_at": string,"district": string | null,"email": string | null,"floor": string | null,"full_name": string,"governorate_id": number | null,"id": string,"is_banned": boolean,"landmark": string | null,"phone": string | null,"postal_code": string | null,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"alt_phone"?: string | null,"apartment"?: string | null,"banned_at"?: string | null,"banned_reason"?: string | null,"city"?: string | null,"created_at"?: string,"district"?: string | null,"email"?: string | null,"floor"?: string | null,"full_name"?: string,"governorate_id"?: number | null,"id": string,"is_banned"?: boolean,"landmark"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "address"?: string | null,"alt_phone"?: string | null,"apartment"?: string | null,"banned_at"?: string | null,"banned_reason"?: string | null,"city"?: string | null,"created_at"?: string,"district"?: string | null,"email"?: string | null,"floor"?: string | null,"full_name"?: string,"governorate_id"?: number | null,"id"?: string,"is_banned"?: boolean,"landmark"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start"?: string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [

                  ]
                },"shop_settings": {
                  Row: {
                    "is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [

                  ]
                },"stock_movements": {
                  Row: {
                    "actor": string | null,"at": string,"delta": number,"id": number,"new_quantity": number,"order_id": number | null,"product_id": number,"reason": Database["public"]['Enums']["stock_reason"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"at"?: string,"delta": number,"id"?: never,"new_quantity": number,"order_id"?: number | null,"product_id": number,"reason": Database["public"]['Enums']["stock_reason"]
                  }
                  Update: {
                    "actor"?: string | null,"at"?: string,"delta"?: number,"id"?: never,"new_quantity"?: number,"order_id"?: number | null,"product_id"?: number,"reason"?: Database["public"]['Enums']["stock_reason"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "customer_stats": {
                  Row: {
                    "favorite_product_id": number | null,"favorite_product_name": string | null,"full_name": string | null,"orders_count": number | null,"phone": string | null,"role": Database["public"]['Enums']["user_role"] | null,"total_spent": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["favorite_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_anonymize_customer":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"admin_approve_order":
{ Args: { "p_note"?: string,"p_order_id": number }; Returns: undefined
                           },
"admin_dashboard":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"admin_delete_category":
{ Args: { "p_id": number,"p_move_to"?: number }; Returns: undefined
                           },
"admin_delete_product":
{ Args: { "p_id": number }; Returns: undefined
                           },
"admin_get_analytics_insights":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_get_forecasts":
{ Args: { "p_run_id"?: number,"p_series_id"?: number,"p_series_type"?: string }; Returns: Json
                           },
"admin_get_reorder_list":
{ Args: { "p_lead_time_days"?: number,"p_service_z"?: number }; Returns: Json
                           },
"admin_reject_order":
{ Args: { "p_order_id": number,"p_reason": string }; Returns: undefined
                           },
"admin_review_payment":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_order_id": number }; Returns: undefined
                           },
"admin_update_product_id":
{ Args: { "p_new_id": number,"p_old_id": number }; Returns: undefined
                           },
"admin_update_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"audit_event":
{ Args: { "p_action": string,"p_entity": string,"p_entity_id": string,"p_new"?: Json,"p_old"?: Json }; Returns: undefined
                           },
"cancel_my_order":
{ Args: { "p_order_id": number }; Returns: undefined
                           },
"check_rate_limit":
{ Args: { "p_action": string,"p_limit": number,"p_window": string }; Returns: undefined
                           },
"check_user_review_eligibility":
{ Args: { "p_product_id": number }; Returns: Json
                           },
"contains_review_profanity":
{ Args: { "p_text": string }; Returns: boolean
                           },
"expire_unpaid_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"get_payment_instructions":
{ Args: { "p_order_id": number }; Returns: Json
                           },
"get_product_review_summary":
{ Args: { "p_product_id": number }; Returns: Json
                           },
"get_product_reviews":
{ Args: { "p_product_id": number }; Returns: {
              "comment": string,"created_at": string,"id": number,"is_own": boolean,"is_verified_purchase": boolean,"product_id": number,"rating": number,"reviewer_name": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_valid_extra_images":
{ Args: { "p_paths": (string)[] }; Returns: boolean
                           },
"mask_review_profanity":
{ Args: { "p_text": string }; Returns: string
                           },
"normalize_review_text":
{ Args: { "p_text": string }; Returns: string
                           },
"place_order":
{ Args: { "p_delivery_method": Database["public"]['Enums']["delivery_method"],"p_items": Json,"p_payment_method": Database["public"]['Enums']["payment_method"],"p_ship": Json }; Returns: number
                           } |
{ Args: { "p_delivery_method": Database["public"]['Enums']["delivery_method"],"p_governorate_id": number,"p_items": Json,"p_notes"?: string,"p_ship_address"?: string,"p_ship_city"?: string,"p_ship_name": string,"p_ship_phone": string }; Returns: number
                           },
"require_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"submit_payment_proof":
{ Args: { "p_order_id": number,"p_proof_path": string,"p_reference": string }; Returns: undefined
                           },
"submit_product_review":
{ Args: { "p_comment": string,"p_product_id": number,"p_rating": number }; Returns: Json
                           }
          }
          Enums: {
            "delivery_method": "egypt_post"|"representative","order_status": "pending"|"confirmed"|"shipped"|"delivered"|"cancelled","payment_method": "cod"|"instapay_qr","payment_status": "unpaid"|"awaiting_proof"|"under_review"|"paid"|"rejected"|"awaiting_approval","stock_reason": "order"|"cancel"|"admin_adjust"|"restock"|"correction","user_role": "customer"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "delivery_method": ["egypt_post", "representative"],"order_status": ["pending", "confirmed", "shipped", "delivered", "cancelled"],"payment_method": ["cod", "instapay_qr"],"payment_status": ["unpaid", "awaiting_proof", "under_review", "paid", "rejected", "awaiting_approval"],"stock_reason": ["order", "cancel", "admin_adjust", "restock", "correction"],"user_role": ["customer", "admin"]
          }
        }
} as const
