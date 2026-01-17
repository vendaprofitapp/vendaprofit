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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_fitting_room_usage: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      colors: {
        Row: {
          created_at: string
          hex_code: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      consortium_drawings: {
        Row: {
          consortium_id: string
          created_at: string
          drawing_date: string
          id: string
          notes: string | null
        }
        Insert: {
          consortium_id: string
          created_at?: string
          drawing_date: string
          id?: string
          notes?: string | null
        }
        Update: {
          consortium_id?: string
          created_at?: string
          drawing_date?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_drawings_consortium_id_fkey"
            columns: ["consortium_id"]
            isOneToOne: false
            referencedRelation: "consortiums"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          total: number
          unit_price: number
          winner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          total?: number
          unit_price?: number
          winner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consortium_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consortium_items_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "consortium_winners"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_participants: {
        Row: {
          consortium_id: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          drawn_at: string | null
          id: string
          is_drawn: boolean
          notes: string | null
          payment_due_day: number | null
          payment_method: string
          updated_at: string
        }
        Insert: {
          consortium_id: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          drawn_at?: string | null
          id?: string
          is_drawn?: boolean
          notes?: string | null
          payment_due_day?: number | null
          payment_method?: string
          updated_at?: string
        }
        Update: {
          consortium_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          drawn_at?: string | null
          id?: string
          is_drawn?: boolean
          notes?: string | null
          payment_due_day?: number | null
          payment_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consortium_participants_consortium_id_fkey"
            columns: ["consortium_id"]
            isOneToOne: false
            referencedRelation: "consortiums"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          installment_number: number
          is_paid: boolean
          notes: string | null
          paid_at: string | null
          participant_id: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_number: number
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          participant_id: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          participant_id?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_payments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "consortium_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_winners: {
        Row: {
          created_at: string
          drawing_id: string
          id: string
          participant_id: string
        }
        Insert: {
          created_at?: string
          drawing_id: string
          id?: string
          participant_id: string
        }
        Update: {
          created_at?: string
          drawing_id?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consortium_winners_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "consortium_drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consortium_winners_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "consortium_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      consortiums: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          installment_value: number
          installments_count: number
          is_active: boolean
          name: string
          owner_id: string
          start_date: string
          total_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          installment_value?: number
          installments_count?: number
          is_active?: boolean
          name: string
          owner_id: string
          start_date: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          installment_value?: number
          installments_count?: number
          is_active?: boolean
          name?: string
          owner_id?: string
          start_date?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_payment_methods: {
        Row: {
          created_at: string
          fee_percent: number
          id: string
          is_active: boolean
          is_deferred: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_percent?: number
          id?: string
          is_active?: boolean
          is_deferred?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_percent?: number
          id?: string
          is_active?: boolean
          is_deferred?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          birth_date: string | null
          created_at: string
          id: string
          instagram: string | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      partnership_auto_share: {
        Row: {
          created_at: string
          enabled: boolean
          group_id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          group_id: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          group_id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_auto_share_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_rules: {
        Row: {
          created_at: string
          group_id: string
          id: string
          owner_cost_percent: number
          owner_profit_percent: number
          seller_cost_percent: number
          seller_profit_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          owner_cost_percent?: number
          owner_profit_percent?: number
          seller_cost_percent?: number
          seller_profit_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          owner_cost_percent?: number
          owner_profit_percent?: number
          seller_cost_percent?: number
          seller_profit_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_fees: {
        Row: {
          created_at: string
          fee_percent: number
          id: string
          owner_id: string
          payment_method: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_percent?: number
          id?: string
          owner_id: string
          payment_method: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_percent?: number
          id?: string
          owner_id?: string
          payment_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_reminders: {
        Row: {
          amount: number
          created_at: string
          customer_instagram: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string
          id: string
          is_paid: boolean
          notes: string | null
          notification_sent: boolean
          notification_sent_at: string | null
          owner_id: string
          paid_at: string | null
          payment_method_name: string
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_instagram?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          owner_id: string
          paid_at?: string | null
          payment_method_name: string
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_instagram?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          owner_id?: string
          paid_at?: string | null
          payment_method_name?: string
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_partnerships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_partnerships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_partnerships_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          product_id: string
          size: string
          sku: string | null
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          product_id: string
          size: string
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          product_id?: string
          size?: string
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          color: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          is_active: boolean
          min_stock_level: number
          name: string
          owner_id: string
          price: number
          size: string | null
          sku: string | null
          stock_quantity: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          min_stock_level?: number
          name: string
          owner_id: string
          price?: number
          size?: string | null
          sku?: string | null
          stock_quantity?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          min_stock_level?: number
          name?: string
          owner_id?: string
          price?: number
          size?: string | null
          sku?: string | null
          stock_quantity?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          gemini_api_key: string | null
          id: string
          openai_api_key: string | null
          phone: string | null
          preferred_ai_provider: string | null
          store_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          gemini_api_key?: string | null
          id: string
          openai_api_key?: string | null
          phone?: string | null
          preferred_ai_provider?: string | null
          store_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          gemini_api_key?: string | null
          id?: string
          openai_api_key?: string | null
          phone?: string | null
          preferred_ai_provider?: string | null
          store_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          notes: string | null
          owner_id: string
          payment_method: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          owner_id: string
          payment_method?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          owner_id?: string
          payment_method?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          product_id: string
          quantity: number
          requester_id: string
          responded_at: string | null
          response_notes: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          product_id: string
          quantity?: number
          requester_id: string
          responded_at?: string | null
          response_notes?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string
          quantity?: number
          requester_id?: string
          responded_at?: string | null
          response_notes?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_partnerships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          store_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_partnerships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_partnerships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          banner_url: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          owner_id: string
          primary_color: string | null
          show_own_products: boolean
          store_description: string | null
          store_name: string
          store_slug: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          owner_id: string
          primary_color?: string | null
          show_own_products?: boolean
          store_description?: string | null
          store_name: string
          store_slug: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          owner_id?: string
          primary_color?: string | null
          show_own_products?: boolean
          store_description?: string | null
          store_name?: string
          store_slug?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          attendant_name: string | null
          attendant_phone: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          purchase_rules: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          attendant_name?: string | null
          attendant_phone?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          purchase_rules?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          attendant_name?: string | null
          attendant_phone?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          purchase_rules?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_fitting_room_usage: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_product_owner: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      is_product_shared_with_user: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      set_partnership_auto_share: {
        Args: { _enabled: boolean; _group_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      group_role: "owner" | "admin" | "member"
      request_status: "pending" | "approved" | "rejected" | "cancelled"
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
      app_role: ["admin", "user"],
      group_role: ["owner", "admin", "member"],
      request_status: ["pending", "approved", "rejected", "cancelled"],
    },
  },
} as const
