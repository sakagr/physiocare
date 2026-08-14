export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_status_logs: {
        Row: {
          appointment_id: string
          changed_at: string
          changed_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          new_status: Database["public"]["Enums"]["appointment_status"]
          old_status: Database["public"]["Enums"]["appointment_status"] | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["appointment_status"]
          old_status?: Database["public"]["Enums"]["appointment_status"] | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["appointment_status"]
          old_status?: Database["public"]["Enums"]["appointment_status"] | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_logs_organization_id_appointment_id_fkey"
            columns: ["organization_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "appointment_status_logs_organization_id_changed_by_fkey"
            columns: ["organization_id", "changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "appointment_status_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_time: string
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          physiotherapist_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_time: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          patient_id: string
          physiotherapist_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_time?: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          physiotherapist_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_organization_id_clinic_id_fkey"
            columns: ["organization_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "appointments_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "appointments_organization_id_physiotherapist_id_fkey"
            columns: ["organization_id", "physiotherapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_name: string
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_name: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_name?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          clinic_name: string
          created_at: string
          deleted_at: string | null
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          pincode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          clinic_name: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          clinic_name?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          appointment_id: string
          created_at: string
          diagnosis_notes: string | null
          followup_notes: string | null
          id: string
          organization_id: string
          pain_areas: Json
          pain_scale: number | null
          patient_id: string
          physiotherapist_id: string
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          diagnosis_notes?: string | null
          followup_notes?: string | null
          id?: string
          organization_id: string
          pain_areas?: Json
          pain_scale?: number | null
          patient_id: string
          physiotherapist_id: string
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          diagnosis_notes?: string | null
          followup_notes?: string | null
          id?: string
          organization_id?: string
          pain_areas?: Json
          pain_scale?: number | null
          patient_id?: string
          physiotherapist_id?: string
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_organization_id_appointment_id_fkey"
            columns: ["organization_id", "appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "consultations_organization_id_physiotherapist_id_fkey"
            columns: ["organization_id", "physiotherapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimal_places: number
          is_active: boolean
          locale: string | null
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          locale?: string | null
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          locale?: string | null
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          gst_percent: number
          id: string
          invoice_id: string
          item_name: string
          organization_id: string
          quantity: number
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          gst_percent?: number
          id?: string
          invoice_id: string
          item_name: string
          organization_id: string
          quantity: number
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          gst_percent?: number
          id?: string
          invoice_id?: string
          item_name?: string
          organization_id?: string
          quantity?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_organization_id_invoice_id_fkey"
            columns: ["organization_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          patient_id: string
          patient_package_id: string | null
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          organization_id: string
          patient_id: string
          patient_package_id?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          organization_id?: string
          patient_id?: string
          patient_package_id?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_appointment_id_fkey"
            columns: ["organization_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invoices_organization_id_clinic_id_fkey"
            columns: ["organization_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invoices_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invoices_organization_id_patient_package_id_fkey"
            columns: ["organization_id", "patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invoices_organization_id_patient_package_id_fkey"
            columns: ["organization_id", "patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages_view"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          deleted_at: string | null
          id: string
          message: string
          notification_type: string
          organization_id: string
          patient_id: string | null
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          message: string
          notification_type: string
          organization_id: string
          patient_id?: string | null
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string
          notification_type?: string
          organization_id?: string
          patient_id?: string | null
          recipient_type?: Database["public"]["Enums"]["recipient_type"]
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_appointment_id_fkey"
            columns: ["organization_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notifications_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          default_currency_code: string | null
          deleted_at: string | null
          id: string
          organization_name: string
          status: Database["public"]["Enums"]["organization_status"]
          subscription_ends_at: string | null
          subscription_plan_id: string
          subscription_starts_at: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_currency_code?: string | null
          deleted_at?: string | null
          id?: string
          organization_name: string
          status?: Database["public"]["Enums"]["organization_status"]
          subscription_ends_at?: string | null
          subscription_plan_id: string
          subscription_starts_at?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_currency_code?: string | null
          deleted_at?: string | null
          id?: string
          organization_name?: string
          status?: Database["public"]["Enums"]["organization_status"]
          subscription_ends_at?: string | null
          subscription_plan_id?: string
          subscription_starts_at?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_currency_code_fkey"
            columns: ["default_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organizations_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      package_session_usage: {
        Row: {
          appointment_id: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          patient_package_id: string
          updated_at: string
          used_on: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          patient_package_id: string
          updated_at?: string
          used_on?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          patient_package_id?: string
          updated_at?: string
          used_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_session_usage_organization_id_appointment_id_fkey"
            columns: ["organization_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "package_session_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_session_usage_organization_id_patient_package_id_fkey"
            columns: ["organization_id", "patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "package_session_usage_organization_id_patient_package_id_fkey"
            columns: ["organization_id", "patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages_view"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          organization_id: string
          package_name: string
          package_price: number
          total_sessions: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          package_name: string
          package_price: number
          total_sessions: number
          updated_at?: string
          validity_days: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          package_name?: string
          package_price?: number
          total_sessions?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_packages: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          deleted_at: string | null
          expiry_date: string
          extended_validity_to: string | null
          id: string
          organization_id: string
          package_id: string
          package_name: string
          package_price: number
          patient_id: string
          purchased_on: string
          remaining_sessions: number
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date: string
          extended_validity_to?: string | null
          id?: string
          organization_id: string
          package_id: string
          package_name: string
          package_price: number
          patient_id: string
          purchased_on?: string
          remaining_sessions: number
          total_sessions: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string
          extended_validity_to?: string | null
          id?: string
          organization_id?: string
          package_id?: string
          package_name?: string
          package_price?: number
          patient_id?: string
          purchased_on?: string
          remaining_sessions?: number
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_organization_id_cancelled_by_fkey"
            columns: ["organization_id", "cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_package_id_fkey"
            columns: ["organization_id", "package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      patient_records: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_url: string
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          record_type: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_url: string
          id?: string
          notes?: string | null
          organization_id: string
          patient_id: string
          record_type: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          record_type?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_records_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patient_records_organization_id_uploaded_by_fkey"
            columns: ["organization_id", "uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dob: string | null
          email: string | null
          emergency_contact: string | null
          full_name: string
          gender: Database["public"]["Enums"]["patient_gender"] | null
          id: string
          organization_id: string
          patient_code: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["patient_gender"] | null
          id?: string
          organization_id: string
          patient_code: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["patient_gender"] | null
          id?: string
          organization_id?: string
          patient_code?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          invoice_id: string
          organization_id: string
          paid_at: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          payment_status: Database["public"]["Enums"]["payment_transaction_status"]
          received_by: string | null
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id: string
          organization_id: string
          paid_at?: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          payment_status?: Database["public"]["Enums"]["payment_transaction_status"]
          received_by?: string | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          organization_id?: string
          paid_at?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          payment_status?: Database["public"]["Enums"]["payment_transaction_status"]
          received_by?: string | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_invoice_id_fkey"
            columns: ["organization_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_organization_id_received_by_fkey"
            columns: ["organization_id", "received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          advice: string | null
          consultation_id: string
          created_at: string
          followup_date: string | null
          id: string
          organization_id: string
          patient_id: string
          physiotherapist_id: string
          updated_at: string
        }
        Insert: {
          advice?: string | null
          consultation_id: string
          created_at?: string
          followup_date?: string | null
          id?: string
          organization_id: string
          patient_id: string
          physiotherapist_id: string
          updated_at?: string
        }
        Update: {
          advice?: string | null
          consultation_id?: string
          created_at?: string
          followup_date?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          physiotherapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_organization_id_consultation_id_fkey"
            columns: ["organization_id", "consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "prescriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "prescriptions_organization_id_physiotherapist_id_fkey"
            columns: ["organization_id", "physiotherapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          name: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          name: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          name?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          deleted_at: string | null
          features: Json
          id: string
          max_clinics: number
          max_users: number
          monthly_price: number
          plan_name: string
          updated_at: string
          yearly_price: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          features?: Json
          id?: string
          max_clinics: number
          max_users: number
          monthly_price?: number
          plan_name: string
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          features?: Json
          id?: string
          max_clinics?: number
          max_users?: number
          monthly_price?: number
          plan_name?: string
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      user_attendance: {
        Row: {
          attendance_date: string
          check_in_time: string | null
          check_out_time: string | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          unavailable_from: string | null
          unavailable_to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          unavailable_from?: string | null
          unavailable_to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          unavailable_from?: string | null
          unavailable_to?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_attendance_organization_id_clinic_id_fkey"
            columns: ["organization_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "user_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_attendance_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      user_clinics: {
        Row: {
          assigned_at: string
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clinics_organization_id_clinic_id_fkey"
            columns: ["organization_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "user_clinics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_clinics_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      user_compensations: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          organization_id: string
          type: Database["public"]["Enums"]["commission_type"]
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          organization_id: string
          type?: Database["public"]["Enums"]["commission_type"]
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["commission_type"]
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_compensations_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "user_compensations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compensations_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string | null
          phone: string | null
          role_id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          role_id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          role_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      patient_packages_view: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          deleted_at: string | null
          expiry_date: string | null
          extended_validity_to: string | null
          id: string | null
          organization_id: string | null
          package_id: string | null
          package_name: string | null
          package_price: number | null
          patient_id: string | null
          purchased_on: string | null
          remaining_sessions: number | null
          status: Database["public"]["Enums"]["package_status"] | null
          total_sessions: number | null
          updated_at: string | null
          used_sessions: number | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          expiry_date?: string | null
          extended_validity_to?: string | null
          id?: string | null
          organization_id?: string | null
          package_id?: string | null
          package_name?: string | null
          package_price?: number | null
          patient_id?: string | null
          purchased_on?: string | null
          remaining_sessions?: number | null
          status?: never
          total_sessions?: number | null
          updated_at?: string | null
          used_sessions?: number | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          expiry_date?: string | null
          extended_validity_to?: string | null
          id?: string | null
          organization_id?: string | null
          package_id?: string | null
          package_name?: string | null
          package_price?: number | null
          patient_id?: string | null
          purchased_on?: string | null
          remaining_sessions?: number | null
          status?: never
          total_sessions?: number | null
          updated_at?: string | null
          used_sessions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_organization_id_cancelled_by_fkey"
            columns: ["organization_id", "cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_package_id_fkey"
            columns: ["organization_id", "package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patient_packages_organization_id_patient_id_fkey"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Functions: {
      consume_package_session: {
        Args: {
          p_appointment_id: string
          p_organization_id: string
          p_patient_package_id: string
          p_used_on?: string
        }
        Returns: {
          appointment_id: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          patient_package_id: string
          updated_at: string
          used_on: string
        }
        SetofOptions: {
          from: "*"
          to: "package_session_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoice_with_items: {
        Args: {
          p_appointment_id?: string
          p_clinic_id: string
          p_created_by?: string
          p_discount_amount: number
          p_gst_amount: number
          p_invoice_date?: string
          p_invoice_number: string
          p_items: Json
          p_organization_id: string
          p_patient_id: string
          p_patient_package_id?: string
          p_subtotal: number
          p_total_amount: number
        }
        Returns: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          patient_id: string
          patient_package_id: string | null
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_organization_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      replace_invoice_items: {
        Args: {
          p_discount_amount: number
          p_gst_amount: number
          p_invoice_date?: string
          p_invoice_id: string
          p_items: Json
          p_organization_id: string
          p_subtotal: number
          p_total_amount: number
        }
        Returns: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          patient_id: string
          patient_package_id: string | null
          subtotal: number
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_package_session_usage: {
        Args: { p_appointment_id: string; p_organization_id: string }
        Returns: {
          appointment_id: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          patient_package_id: string
          updated_at: string
          used_on: string
        }
        SetofOptions: {
          from: "*"
          to: "package_session_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "SUPER_ADMIN"
        | "ORG_OWNER"
        | "ORG_ADMIN"
        | "ORG_PHYSIOTHERAPIST"
        | "ORG_RECEPTIONIST"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "no_show"
      appointment_type:
        | "initial_consultation"
        | "follow_up"
        | "therapy_session"
        | "assessment"
      attendance_status: "present" | "absent" | "half_day" | "leave"
      commission_type: "none" | "percentage" | "fixed"
      notification_channel: "sms" | "email" | "whatsapp" | "in_app"
      notification_status: "pending" | "sent" | "failed" | "cancelled"
      organization_status: "draft" | "active" | "inactive" | "archived"
      package_status: "active" | "completed" | "expired" | "cancelled"
      patient_gender: "female" | "male" | "other" | "prefer_not_to_say"
      payment_mode:
        | "cash"
        | "card"
        | "upi"
        | "bank_transfer"
        | "cheque"
        | "wallet"
        | "other"
      payment_status:
        | "unpaid"
        | "partially_paid"
        | "paid"
        | "refunded"
        | "cancelled"
      payment_transaction_status: "completed" | "refunded" | "cancelled"
      recipient_type: "user" | "patient"
      subscription_status:
        | "inactive"
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "SUPER_ADMIN",
        "ORG_OWNER",
        "ORG_ADMIN",
        "ORG_PHYSIOTHERAPIST",
        "ORG_RECEPTIONIST",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
      ],
      appointment_type: [
        "initial_consultation",
        "follow_up",
        "therapy_session",
        "assessment",
      ],
      attendance_status: ["present", "absent", "half_day", "leave"],
      commission_type: ["none", "percentage", "fixed"],
      notification_channel: ["sms", "email", "whatsapp", "in_app"],
      notification_status: ["pending", "sent", "failed", "cancelled"],
      organization_status: ["draft", "active", "inactive", "archived"],
      package_status: ["active", "completed", "expired", "cancelled"],
      patient_gender: ["female", "male", "other", "prefer_not_to_say"],
      payment_mode: [
        "cash",
        "card",
        "upi",
        "bank_transfer",
        "cheque",
        "wallet",
        "other",
      ],
      payment_status: [
        "unpaid",
        "partially_paid",
        "paid",
        "refunded",
        "cancelled",
      ],
      payment_transaction_status: ["completed", "refunded", "cancelled"],
      recipient_type: ["user", "patient"],
      subscription_status: [
        "inactive",
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
    },
  },
} as const

