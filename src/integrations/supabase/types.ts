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
      battle_sessions: {
        Row: {
          app_version: string | null
          bs_points: number | null
          client_session_id: string | null
          created_at: string
          encounter_id: string | null
          encounter_name: string | null
          ended_at: string | null
          enemy_formation: Json
          enemy_units_damaged: number
          enemy_units_killed: number
          enemy_units_total: number
          id: string
          is_boss_strike: boolean
          outcome: string | null
          player_formation: Json
          player_units_damaged: number
          player_units_killed: number
          player_units_total: number
          started_at: string
          total_turns: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          bs_points?: number | null
          client_session_id?: string | null
          created_at?: string
          encounter_id?: string | null
          encounter_name?: string | null
          ended_at?: string | null
          enemy_formation?: Json
          enemy_units_damaged?: number
          enemy_units_killed?: number
          enemy_units_total?: number
          id?: string
          is_boss_strike?: boolean
          outcome?: string | null
          player_formation?: Json
          player_units_damaged?: number
          player_units_killed?: number
          player_units_total?: number
          started_at?: string
          total_turns?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          bs_points?: number | null
          client_session_id?: string | null
          created_at?: string
          encounter_id?: string | null
          encounter_name?: string | null
          ended_at?: string | null
          enemy_formation?: Json
          enemy_units_damaged?: number
          enemy_units_killed?: number
          enemy_units_total?: number
          id?: string
          is_boss_strike?: boolean
          outcome?: string | null
          player_formation?: Json
          player_units_damaged?: number
          player_units_killed?: number
          player_units_total?: number
          started_at?: string
          total_turns?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      battle_turn_events: {
        Row: {
          actions: Json
          created_at: string
          id: string
          is_player_turn: boolean
          session_id: string
          summary: Json | null
          turn_number: number
          wave_number: number
        }
        Insert: {
          actions?: Json
          created_at?: string
          id?: string
          is_player_turn?: boolean
          session_id: string
          summary?: Json | null
          turn_number: number
          wave_number?: number
        }
        Update: {
          actions?: Json
          created_at?: string
          id?: string
          is_player_turn?: boolean
          session_id?: string
          summary?: Json | null
          turn_number?: number
          wave_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_turn_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "battle_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          created_at: string
          id: string
          name: string
          units: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          units?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          units?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          discord_username: string | null
          has_access: boolean | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discord_username?: string | null
          has_access?: boolean | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          discord_username?: string | null
          has_access?: boolean | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          account_level: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_level?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_level?: number
          created_at?: string
          id?: string
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
      validate_party_units: { Args: { units_json: Json }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
