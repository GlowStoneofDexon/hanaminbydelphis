export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_reinvestment: boolean
          related_material_purchase_id: string | null
          spent_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_reinvestment?: boolean
          related_material_purchase_id?: string | null
          spent_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_reinvestment?: boolean
          related_material_purchase_id?: string | null
          spent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_related_material_purchase_id_fkey"
            columns: ["related_material_purchase_id"]
            isOneToOne: false
            referencedRelation: "material_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string | null
          id: string
          photo_url: string | null
          product_id: string | null
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          photo_url?: string | null
          product_id?: string | null
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          photo_url?: string | null
          product_id?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed: boolean
          created_at: string
          current_amount: number
          deadline: string | null
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          target_amount: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          target_amount?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          target_amount?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      material_purchases: {
        Row: {
          created_at: string
          id: string
          material_id: string
          notes: string | null
          purchased_at: string
          qty: number
          supplier_id: string | null
          total_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          purchased_at?: string
          qty: number
          supplier_id?: string | null
          total_cost: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          purchased_at?: string
          qty?: number
          supplier_id?: string | null
          total_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_purchases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          avg_unit_cost: number
          created_at: string
          current_qty: number
          id: string
          low_threshold: number
          name: string
          unit: Database["public"]["Enums"]["material_unit"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_unit_cost?: number
          created_at?: string
          current_qty?: number
          id?: string
          low_threshold?: number
          name: string
          unit?: Database["public"]["Enums"]["material_unit"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_unit_cost?: number
          created_at?: string
          current_qty?: number
          id?: string
          low_threshold?: number
          name?: string
          unit?: Database["public"]["Enums"]["material_unit"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          qty: number
          unit_cost_snapshot: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          qty: number
          unit_cost_snapshot?: number
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          qty?: number
          unit_cost_snapshot?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          ordered_at: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          platform: Database["public"]["Enums"]["order_platform"]
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          platform?: Database["public"]["Enums"]["order_platform"]
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          platform?: Database["public"]["Enums"]["order_platform"]
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipe_items: {
        Row: {
          created_at: string
          id: string
          material_id: string
          product_id: string
          qty_per_unit: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          product_id: string
          qty_per_unit: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          product_id?: string
          qty_per_unit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived: boolean
          category: string | null
          created_at: string
          current_stock: number
          description: string | null
          id: string
          labor_cost: number
          name: string
          overhead_cost: number
          photo_url: string | null
          selling_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          labor_cost?: number
          name: string
          overhead_cost?: number
          photo_url?: string | null
          selling_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          labor_cost?: number
          name?: string
          overhead_cost?: number
          photo_url?: string | null
          selling_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          created_at: string
          currency: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      goal_kind: "revenue" | "units_sold" | "savings" | "custom"
      material_unit: "g" | "ml" | "pcs"
      order_platform:
        | "facebook"
        | "instagram"
        | "website"
        | "whatsapp"
        | "in_person"
        | "other"
      order_status: "new" | "processing" | "shipped" | "delivered" | "cancelled"
      payment_method: "cash" | "bkash" | "nagad" | "bank" | "other"
      wallet_kind: "cash" | "bkash" | "nagad" | "bank"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      goal_kind: ["revenue", "units_sold", "savings", "custom"],
      material_unit: ["g", "ml", "pcs"],
      order_platform: [
        "facebook",
        "instagram",
        "website",
        "whatsapp",
        "in_person",
        "other",
      ],
      order_status: ["new", "processing", "shipped", "delivered", "cancelled"],
      payment_method: ["cash", "bkash", "nagad", "bank", "other"],
      wallet_kind: ["cash", "bkash", "nagad", "bank"],
    },
  },
} as const
