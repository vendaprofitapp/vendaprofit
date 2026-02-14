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
      ad_campaigns: {
        Row: {
          campaign_name: string | null
          campaign_type: string | null
          created_at: string
          daily_budget: number
          error_message: string | null
          id: string
          integration_id: string
          owner_id: string
          platform: string
          platform_campaign_id: string | null
          product_id: string | null
          status: string
          target_url: string | null
          updated_at: string
        }
        Insert: {
          campaign_name?: string | null
          campaign_type?: string | null
          created_at?: string
          daily_budget: number
          error_message?: string | null
          id?: string
          integration_id: string
          owner_id: string
          platform: string
          platform_campaign_id?: string | null
          product_id?: string | null
          status?: string
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          campaign_name?: string | null
          campaign_type?: string | null
          created_at?: string
          daily_budget?: number
          error_message?: string | null
          id?: string
          integration_id?: string
          owner_id?: string
          platform?: string
          platform_campaign_id?: string | null
          product_id?: string | null
          status?: string
          target_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "user_ad_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
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
      catalog_product_views: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          owner_id: string
          product_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          owner_id: string
          product_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          owner_id?: string
          product_id?: string
          store_id?: string
        }
        Relationships: []
      }
      catalog_search_logs: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          owner_id: string
          results_count: number
          search_term: string
          store_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          owner_id: string
          results_count?: number
          search_term: string
          store_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          owner_id?: string
          results_count?: number
          search_term?: string
          store_id?: string
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
      consignment_items: {
        Row: {
          consignment_id: string
          created_at: string
          id: string
          original_price: number
          product_id: string
          status: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          consignment_id: string
          created_at?: string
          id?: string
          original_price: number
          product_id: string
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          consignment_id?: string
          created_at?: string
          id?: string
          original_price?: number
          product_id?: string
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consignment_items_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      consignments: {
        Row: {
          access_token: string
          approved_at: string | null
          created_at: string
          customer_id: string | null
          deadline_at: string | null
          id: string
          seller_id: string
          shipping_cost: number | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          approved_at?: string | null
          created_at?: string
          customer_id?: string | null
          deadline_at?: string | null
          id?: string
          seller_id: string
          shipping_cost?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          approved_at?: string | null
          created_at?: string
          customer_id?: string | null
          deadline_at?: string | null
          id?: string
          seller_id?: string
          shipping_cost?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          current_balance: number
          customer_name: string
          customer_phone: string | null
          drawn_at: string | null
          first_shipping_used: boolean
          id: string
          is_drawn: boolean
          notes: string | null
          payment_due_day: number | null
          payment_method: string
          status: string
          updated_at: string
        }
        Insert: {
          consortium_id: string
          created_at?: string
          current_balance?: number
          customer_name: string
          customer_phone?: string | null
          drawn_at?: string | null
          first_shipping_used?: boolean
          id?: string
          is_drawn?: boolean
          notes?: string | null
          payment_due_day?: number | null
          payment_method?: string
          status?: string
          updated_at?: string
        }
        Update: {
          consortium_id?: string
          created_at?: string
          current_balance?: number
          customer_name?: string
          customer_phone?: string | null
          drawn_at?: string | null
          first_shipping_used?: boolean
          id?: string
          is_drawn?: boolean
          notes?: string | null
          payment_due_day?: number | null
          payment_method?: string
          status?: string
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
      consortium_settings: {
        Row: {
          consortium_id: string
          created_at: string
          grace_period_days: number
          id: string
          penalty_money_pct: number
          penalty_product_pct: number
          rebalance_mode: string
          shipping_policy: string
          updated_at: string
        }
        Insert: {
          consortium_id: string
          created_at?: string
          grace_period_days?: number
          id?: string
          penalty_money_pct?: number
          penalty_product_pct?: number
          rebalance_mode?: string
          shipping_policy?: string
          updated_at?: string
        }
        Update: {
          consortium_id?: string
          created_at?: string
          grace_period_days?: number
          id?: string
          penalty_money_pct?: number
          penalty_product_pct?: number
          rebalance_mode?: string
          shipping_policy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consortium_settings_consortium_id_fkey"
            columns: ["consortium_id"]
            isOneToOne: true
            referencedRelation: "consortiums"
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
      customer_orders: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          status: string
          supplier_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          status?: string
          supplier_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string
          supplier_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          id: string
          instagram: string | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          photo_url: string | null
          size: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          photo_url?: string | null
          size?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          photo_url?: string | null
          size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      direct_partnership_invites: {
        Row: {
          cost_split_ratio: number | null
          created_at: string
          group_id: string | null
          id: string
          invite_code: string
          invitee_email: string
          inviter_id: string
          owner_commission_percent: number | null
          profit_share_partner: number | null
          profit_share_seller: number | null
          status: string
          updated_at: string
        }
        Insert: {
          cost_split_ratio?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          invite_code?: string
          invitee_email: string
          inviter_id: string
          owner_commission_percent?: number | null
          profit_share_partner?: number | null
          profit_share_seller?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          cost_split_ratio?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          invite_code?: string
          invitee_email?: string
          inviter_id?: string
          owner_commission_percent?: number | null
          profit_share_partner?: number | null
          profit_share_seller?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_partnership_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          expense_id: string
          id: string
          installment_number: number
          is_paid: boolean
          paid_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date: string
          expense_id: string
          id?: string
          installment_number: number
          is_paid?: boolean
          paid_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          expense_id?: string
          id?: string
          installment_number?: number
          is_paid?: boolean
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_installments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          id: string
          is_paid: boolean
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expense_id: string
          id?: string
          is_paid?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          id?: string
          is_paid?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          category_type: string
          created_at: string
          custom_split_percent: number | null
          description: string | null
          expense_date: string
          group_id: string | null
          id: string
          installment_count: number | null
          is_installment: boolean
          is_recurring: boolean
          owner_id: string
          recurring_day: number | null
          split_mode: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          category_type?: string
          created_at?: string
          custom_split_percent?: number | null
          description?: string | null
          expense_date?: string
          group_id?: string | null
          id?: string
          installment_count?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          owner_id: string
          recurring_day?: number | null
          split_mode?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          category_type?: string
          created_at?: string
          custom_split_percent?: number | null
          description?: string | null
          expense_date?: string
          group_id?: string | null
          id?: string
          installment_count?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          owner_id?: string
          recurring_day?: number | null
          split_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_splits: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          sale_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          sale_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          sale_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          commission_percent: number
          cost_split_ratio: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string | null
          is_direct: boolean
          name: string
          profit_share_partner: number
          profit_share_seller: number
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          cost_split_ratio?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string | null
          is_direct?: boolean
          name: string
          profit_share_partner?: number
          profit_share_seller?: number
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          cost_split_ratio?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          is_direct?: boolean
          name?: string
          profit_share_partner?: number
          profit_share_seller?: number
          updated_at?: string
        }
        Relationships: []
      }
      landing_page_faqs: {
        Row: {
          answer: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          owner_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          owner_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          owner_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_page_features: {
        Row: {
          created_at: string
          description: string
          display_order: number
          icon_name: string
          id: string
          is_active: boolean
          owner_id: string
          section_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          icon_name: string
          id?: string
          is_active?: boolean
          owner_id: string
          section_type: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          section_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_page_pricing: {
        Row: {
          badge_color: string | null
          badge_text: string | null
          button_link: string | null
          button_text: string
          created_at: string
          display_order: number
          features: Json
          id: string
          is_active: boolean
          is_popular: boolean
          owner_id: string
          plan_name: string
          plan_subtitle: string
          price: string
          price_note: string | null
          price_period: string
          updated_at: string
        }
        Insert: {
          badge_color?: string | null
          badge_text?: string | null
          button_link?: string | null
          button_text: string
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          owner_id: string
          plan_name: string
          plan_subtitle: string
          price: string
          price_note?: string | null
          price_period: string
          updated_at?: string
        }
        Update: {
          badge_color?: string | null
          badge_text?: string | null
          button_link?: string | null
          button_text?: string
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          owner_id?: string
          plan_name?: string
          plan_subtitle?: string
          price?: string
          price_note?: string | null
          price_period?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_page_settings: {
        Row: {
          bio_video_full: string | null
          bio_video_preview: string | null
          created_at: string
          cta_button_text: string | null
          cta_features: Json | null
          cta_subtitle: string | null
          cta_title: string | null
          faq_title: string | null
          faq_title_highlight: string | null
          features_subtitle: string | null
          features_title: string | null
          features_title_highlight: string | null
          footer_copyright: string | null
          hero_badge_text: string | null
          hero_cta_primary_text: string | null
          hero_cta_secondary_text: string | null
          hero_footer_text: string | null
          hero_subtitle: string | null
          hero_title: string | null
          hero_title_highlight: string | null
          id: string
          logo_url: string | null
          owner_id: string
          pricing_subtitle: string | null
          pricing_title: string | null
          pricing_title_highlight: string | null
          primary_color: string | null
          testimonials_subtitle: string | null
          testimonials_title: string | null
          testimonials_title_highlight: string | null
          updated_at: string
          video_badge_text: string | null
          video_footer_text: string | null
          video_subtitle: string | null
          video_title: string | null
          video_title_highlight: string | null
          video_url: string | null
        }
        Insert: {
          bio_video_full?: string | null
          bio_video_preview?: string | null
          created_at?: string
          cta_button_text?: string | null
          cta_features?: Json | null
          cta_subtitle?: string | null
          cta_title?: string | null
          faq_title?: string | null
          faq_title_highlight?: string | null
          features_subtitle?: string | null
          features_title?: string | null
          features_title_highlight?: string | null
          footer_copyright?: string | null
          hero_badge_text?: string | null
          hero_cta_primary_text?: string | null
          hero_cta_secondary_text?: string | null
          hero_footer_text?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          hero_title_highlight?: string | null
          id?: string
          logo_url?: string | null
          owner_id: string
          pricing_subtitle?: string | null
          pricing_title?: string | null
          pricing_title_highlight?: string | null
          primary_color?: string | null
          testimonials_subtitle?: string | null
          testimonials_title?: string | null
          testimonials_title_highlight?: string | null
          updated_at?: string
          video_badge_text?: string | null
          video_footer_text?: string | null
          video_subtitle?: string | null
          video_title?: string | null
          video_title_highlight?: string | null
          video_url?: string | null
        }
        Update: {
          bio_video_full?: string | null
          bio_video_preview?: string | null
          created_at?: string
          cta_button_text?: string | null
          cta_features?: Json | null
          cta_subtitle?: string | null
          cta_title?: string | null
          faq_title?: string | null
          faq_title_highlight?: string | null
          features_subtitle?: string | null
          features_title?: string | null
          features_title_highlight?: string | null
          footer_copyright?: string | null
          hero_badge_text?: string | null
          hero_cta_primary_text?: string | null
          hero_cta_secondary_text?: string | null
          hero_footer_text?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          hero_title_highlight?: string | null
          id?: string
          logo_url?: string | null
          owner_id?: string
          pricing_subtitle?: string | null
          pricing_title?: string | null
          pricing_title_highlight?: string | null
          primary_color?: string | null
          testimonials_subtitle?: string | null
          testimonials_title?: string | null
          testimonials_title_highlight?: string | null
          updated_at?: string
          video_badge_text?: string | null
          video_footer_text?: string | null
          video_subtitle?: string | null
          video_title?: string | null
          video_title_highlight?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      landing_page_testimonials: {
        Row: {
          avatar_url: string | null
          content: string
          created_at: string
          customer_name: string
          customer_role: string
          display_order: number
          id: string
          is_active: boolean
          owner_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          content: string
          created_at?: string
          customer_name: string
          customer_role: string
          display_order?: number
          id?: string
          is_active?: boolean
          owner_id: string
          rating?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          content?: string
          created_at?: string
          customer_name?: string
          customer_role?: string
          display_order?: number
          id?: string
          is_active?: boolean
          owner_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_cart_items: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          product_id: string | null
          product_name: string
          quantity: number
          selected_size: string | null
          status: string
          unit_price: number
          variant_color: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          selected_size?: string | null
          status?: string
          unit_price?: number
          variant_color?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_size?: string | null
          status?: string
          unit_price?: number
          variant_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_cart_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "store_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      main_categories: {
        Row: {
          created_at: string
          display_order: number
          has_subcategories: boolean
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          has_subcategories?: boolean
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          has_subcategories?: boolean
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          expires_at: string | null
          group_id: string | null
          id: string
          is_completed: boolean
          metric_secondary: number | null
          metric_value: number | null
          owner_id: string
          product_id: string | null
          product_name: string | null
          store_slug: string | null
          task_type: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          is_completed?: boolean
          metric_secondary?: number | null
          metric_value?: number | null
          owner_id: string
          product_id?: string | null
          product_name?: string | null
          store_slug?: string | null
          task_type: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          is_completed?: boolean
          metric_secondary?: number | null
          metric_value?: number | null
          owner_id?: string
          product_id?: string | null
          product_name?: string | null
          store_slug?: string | null
          task_type?: string
          title?: string
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
          created_at: string
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          marketing_delivery_days: number | null
          marketing_price: number | null
          marketing_prices: Json | null
          marketing_status: string[] | null
          product_id: string
          size: string
          sku: string | null
          stock_quantity: number
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          marketing_delivery_days?: number | null
          marketing_price?: number | null
          marketing_prices?: Json | null
          marketing_status?: string[] | null
          product_id: string
          size: string
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          marketing_delivery_days?: number | null
          marketing_price?: number | null
          marketing_prices?: Json | null
          marketing_status?: string[] | null
          product_id?: string
          size?: string
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
          video_url?: string | null
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
      product_waitlist: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_waitlist_product_id_fkey"
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
          category_2: string | null
          category_3: string | null
          color: string | null
          color_label: string | null
          cost_price: number | null
          created_at: string
          custom_detail: string | null
          description: string | null
          group_id: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          is_active: boolean
          is_new_release: boolean
          length_cm: number | null
          main_category: string | null
          marketing_status: string[] | null
          min_stock_level: number
          model: string | null
          name: string
          owner_id: string
          price: number
          size: string | null
          sku: string | null
          stock_quantity: number
          subcategory: string | null
          supplier_id: string | null
          updated_at: string
          video_url: string | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          category: string
          category_2?: string | null
          category_3?: string | null
          color?: string | null
          color_label?: string | null
          cost_price?: number | null
          created_at?: string
          custom_detail?: string | null
          description?: string | null
          group_id?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          is_new_release?: boolean
          length_cm?: number | null
          main_category?: string | null
          marketing_status?: string[] | null
          min_stock_level?: number
          model?: string | null
          name: string
          owner_id: string
          price?: number
          size?: string | null
          sku?: string | null
          stock_quantity?: number
          subcategory?: string | null
          supplier_id?: string | null
          updated_at?: string
          video_url?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          category?: string
          category_2?: string | null
          category_3?: string | null
          color?: string | null
          color_label?: string | null
          cost_price?: number | null
          created_at?: string
          custom_detail?: string | null
          description?: string | null
          group_id?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          is_new_release?: boolean
          length_cm?: number | null
          main_category?: string | null
          marketing_status?: string[] | null
          min_stock_level?: number
          model?: string | null
          name?: string
          owner_id?: string
          price?: number
          size?: string | null
          sku?: string | null
          stock_quantity?: number
          subcategory?: string | null
          supplier_id?: string | null
          updated_at?: string
          video_url?: string | null
          weight_grams?: number | null
          width_cm?: number | null
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
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          gemini_api_key: string | null
          id: string
          melhor_envio_token: string | null
          openai_api_key: string | null
          origin_zip: string | null
          phone: string | null
          preferred_ai_provider: string | null
          store_name: string | null
          superfrete_token: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          gemini_api_key?: string | null
          id: string
          melhor_envio_token?: string | null
          openai_api_key?: string | null
          origin_zip?: string | null
          phone?: string | null
          preferred_ai_provider?: string | null
          store_name?: string | null
          superfrete_token?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          gemini_api_key?: string | null
          id?: string
          melhor_envio_token?: string | null
          openai_api_key?: string | null
          origin_zip?: string | null
          phone?: string | null
          preferred_ai_provider?: string | null
          store_name?: string | null
          superfrete_token?: string | null
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
          sale_source: string
          shipping_address: string | null
          shipping_company: string | null
          shipping_cost: number | null
          shipping_label_url: string | null
          shipping_method: string | null
          shipping_notes: string | null
          shipping_payer: string | null
          shipping_tracking: string | null
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
          sale_source?: string
          shipping_address?: string | null
          shipping_company?: string | null
          shipping_cost?: number | null
          shipping_label_url?: string | null
          shipping_method?: string | null
          shipping_notes?: string | null
          shipping_payer?: string | null
          shipping_tracking?: string | null
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
          sale_source?: string
          shipping_address?: string | null
          shipping_company?: string | null
          shipping_cost?: number | null
          shipping_label_url?: string | null
          shipping_method?: string | null
          shipping_notes?: string | null
          shipping_payer?: string | null
          shipping_tracking?: string | null
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
          variant_color: string | null
          variant_id: string | null
          variant_size: string | null
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
          variant_color?: string | null
          variant_id?: string | null
          variant_size?: string | null
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
          variant_color?: string | null
          variant_id?: string | null
          variant_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_leads: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          last_seen_at: string | null
          name: string
          owner_id: string
          store_id: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          owner_id: string
          store_id: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          owner_id?: string
          store_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
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
          background_color: string | null
          banner_height_desktop: string | null
          banner_height_mobile: string | null
          banner_link: string | null
          banner_url: string | null
          banner_url_mobile: string | null
          bio_video_full: string | null
          bio_video_preview: string | null
          card_background_color: string | null
          created_at: string
          custom_domain: string | null
          custom_font_name: string | null
          custom_font_url: string | null
          filter_buttons_config: Json | null
          font_body: string | null
          font_heading: string | null
          id: string
          is_active: boolean
          is_banner_visible: boolean | null
          lead_capture_enabled: boolean | null
          logo_position: string | null
          logo_size: string | null
          logo_url: string | null
          opportunities_button_color: string | null
          opportunities_button_text: string | null
          owner_id: string
          primary_color: string | null
          purchase_incentives_config: Json | null
          secret_area_active: boolean | null
          secret_area_name: string | null
          secret_area_password: string | null
          show_opportunities_button: boolean | null
          show_own_products: boolean
          show_store_description: boolean | null
          show_store_url: boolean | null
          store_description: string | null
          store_name: string
          store_slug: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          background_color?: string | null
          banner_height_desktop?: string | null
          banner_height_mobile?: string | null
          banner_link?: string | null
          banner_url?: string | null
          banner_url_mobile?: string | null
          bio_video_full?: string | null
          bio_video_preview?: string | null
          card_background_color?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_font_name?: string | null
          custom_font_url?: string | null
          filter_buttons_config?: Json | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          is_active?: boolean
          is_banner_visible?: boolean | null
          lead_capture_enabled?: boolean | null
          logo_position?: string | null
          logo_size?: string | null
          logo_url?: string | null
          opportunities_button_color?: string | null
          opportunities_button_text?: string | null
          owner_id: string
          primary_color?: string | null
          purchase_incentives_config?: Json | null
          secret_area_active?: boolean | null
          secret_area_name?: string | null
          secret_area_password?: string | null
          show_opportunities_button?: boolean | null
          show_own_products?: boolean
          show_store_description?: boolean | null
          show_store_url?: boolean | null
          store_description?: string | null
          store_name: string
          store_slug: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          background_color?: string | null
          banner_height_desktop?: string | null
          banner_height_mobile?: string | null
          banner_link?: string | null
          banner_url?: string | null
          banner_url_mobile?: string | null
          bio_video_full?: string | null
          bio_video_preview?: string | null
          card_background_color?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_font_name?: string | null
          custom_font_url?: string | null
          filter_buttons_config?: Json | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          is_active?: boolean
          is_banner_visible?: boolean | null
          lead_capture_enabled?: boolean | null
          logo_position?: string | null
          logo_size?: string | null
          logo_url?: string | null
          opportunities_button_color?: string | null
          opportunities_button_text?: string | null
          owner_id?: string
          primary_color?: string | null
          purchase_incentives_config?: Json | null
          secret_area_active?: boolean | null
          secret_area_name?: string | null
          secret_area_password?: string | null
          show_opportunities_button?: boolean | null
          show_own_products?: boolean
          show_store_description?: boolean | null
          show_store_url?: boolean | null
          store_description?: string | null
          store_name?: string
          store_slug?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          main_category_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          main_category_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          main_category_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "main_categories"
            referencedColumns: ["id"]
          },
        ]
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
      user_ad_integrations: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          created_at: string
          id: string
          is_active: boolean
          owner_id: string
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id: string
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
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
      waitlist_notifications: {
        Row: {
          consignment_item_id: string
          created_at: string
          id: string
          product_id: string
          status: string
          waitlist_id: string
        }
        Insert: {
          consignment_item_id: string
          created_at?: string
          id?: string
          product_id: string
          status?: string
          waitlist_id: string
        }
        Update: {
          consignment_item_id?: string
          created_at?: string
          id?: string
          product_id?: string
          status?: string
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_notifications_consignment_item_id_fkey"
            columns: ["consignment_item_id"]
            isOneToOne: false
            referencedRelation: "consignment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_notifications_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "product_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_stock_request: {
        Args: { _request_id: string; _response_notes?: string }
        Returns: Json
      }
      cleanup_old_fitting_room_usage: { Args: never; Returns: undefined }
      clear_category_from_products: {
        Args: { category_name: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_direct_partner: {
        Args: { _partner_id: string; _user_id: string }
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
      merge_categories: {
        Args: { destination_name: string; source_name: string }
        Returns: undefined
      }
      process_consortium_withdrawal: {
        Args: {
          _participant_id: string
          _penalty_pct: number
          _withdrawal_type: string
        }
        Returns: Json
      }
      rebalance_consortium_installments: {
        Args: {
          _consortium_id: string
          _remaining_unpaid: number
          _withdrawn_participant_id: string
        }
        Returns: undefined
      }
      rename_category_in_products: {
        Args: { new_name: string; old_name: string }
        Returns: undefined
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
