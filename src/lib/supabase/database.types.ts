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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      aggregate_positions: {
        Row: {
          aggregate_id: string
          average_position: number | null
          ballot_count: number
          distribution: Json
          entity_id: string
          points: number
          position: number
        }
        Insert: {
          aggregate_id: string
          average_position?: number | null
          ballot_count: number
          distribution?: Json
          entity_id: string
          points: number
          position: number
        }
        Update: {
          aggregate_id?: string
          average_position?: number | null
          ballot_count?: number
          distribution?: Json
          entity_id?: string
          points?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "aggregate_positions_aggregate_id_fkey"
            columns: ["aggregate_id"]
            isOneToOne: false
            referencedRelation: "aggregates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aggregate_positions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      aggregates: {
        Row: {
          calculated_at: string
          cohort_definition: Json
          cohort_signature: string
          cycle_id: string | null
          eligible_ballot_count: number
          id: string
          method_version: string
          suppression_status: string
          template_version_id: string
        }
        Insert: {
          calculated_at?: string
          cohort_definition?: Json
          cohort_signature: string
          cycle_id?: string | null
          eligible_ballot_count: number
          id?: string
          method_version: string
          suppression_status?: string
          template_version_id: string
        }
        Update: {
          calculated_at?: string
          cohort_definition?: Json
          cohort_signature?: string
          cycle_id?: string | null
          eligible_ballot_count?: number
          id?: string
          method_version?: string
          suppression_status?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "ranking_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aggregates_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "ranking_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_definitions: {
        Row: {
          created_at: string
          description: string | null
          direction: string | null
          entity_type_id: string
          freshness: string
          id: string
          key: string
          label: string
          metric_group: string | null
          public_visible: boolean
          source_id: string | null
          unit: string | null
          value_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          direction?: string | null
          entity_type_id: string
          freshness?: string
          id?: string
          key: string
          label: string
          metric_group?: string | null
          public_visible?: boolean
          source_id?: string | null
          unit?: string | null
          value_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          direction?: string | null
          entity_type_id?: string
          freshness?: string
          id?: string
          key?: string
          label?: string
          metric_group?: string | null
          public_visible?: boolean
          source_id?: string | null
          unit?: string | null
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_definitions_entity_type_id_fkey"
            columns: ["entity_type_id"]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribute_definitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_dimensions: {
        Row: {
          collection_method: string
          description: string | null
          id: string
          multi_select: boolean
          name: string
          sensitive: boolean
          slug: string
          status: string
        }
        Insert: {
          collection_method: string
          description?: string | null
          id?: string
          multi_select?: boolean
          name: string
          sensitive?: boolean
          slug: string
          status?: string
        }
        Update: {
          collection_method?: string
          description?: string | null
          id?: string
          multi_select?: boolean
          name?: string
          sensitive?: boolean
          slug?: string
          status?: string
        }
        Relationships: []
      }
      cohort_values: {
        Row: {
          dimension_id: string
          id: string
          label: string
          metadata: Json
          slug: string
          sort_order: number
        }
        Insert: {
          dimension_id: string
          id?: string
          label: string
          metadata?: Json
          slug: string
          sort_order?: number
        }
        Update: {
          dimension_id?: string
          id?: string
          label?: string
          metadata?: Json
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cohort_values_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "cohort_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          created_at: string
          homepage_url: string | null
          id: string
          name: string
          rights_metadata: Json
          slug: string
        }
        Insert: {
          created_at?: string
          homepage_url?: string | null
          id?: string
          name: string
          rights_metadata?: Json
          slug: string
        }
        Update: {
          created_at?: string
          homepage_url?: string | null
          id?: string
          name?: string
          rights_metadata?: Json
          slug?: string
        }
        Relationships: []
      }
      dataset_versions: {
        Row: {
          dataset_id: string
          fetched_at: string
          id: string
          published_at: string | null
          row_count: number
          season: number | null
          source_metadata: Json
          source_request_count: number
          status: string
          validation_summary: Json
          version_key: string
          week: number | null
        }
        Insert: {
          dataset_id: string
          fetched_at?: string
          id?: string
          published_at?: string | null
          row_count?: number
          season?: number | null
          source_metadata?: Json
          source_request_count?: number
          status?: string
          validation_summary?: Json
          version_key: string
          week?: number | null
        }
        Update: {
          dataset_id?: string
          fetched_at?: string
          id?: string
          published_at?: string | null
          row_count?: number
          season?: number | null
          source_metadata?: Json
          source_request_count?: number
          status?: string
          validation_summary?: Json
          version_key?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dataset_versions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          active_version_id: string | null
          created_at: string
          description: string | null
          domain_id: string
          id: string
          name: string
          refresh_cadence: string
          slug: string
          source_id: string | null
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          domain_id: string
          id?: string
          name: string
          refresh_cadence?: string
          slug: string
          source_id?: string | null
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          description?: string | null
          domain_id?: string
          id?: string
          name?: string
          refresh_cadence?: string
          slug?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datasets_active_version_id_fkey"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          canonical_key: string
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          domain_id: string
          entity_type_id: string
          id: string
          image_url: string | null
          name: string
          short_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          canonical_key: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          domain_id: string
          entity_type_id: string
          id?: string
          image_url?: string | null
          name: string
          short_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_key?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          domain_id?: string
          entity_type_id?: string
          id?: string
          image_url?: string | null
          name?: string
          short_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_entity_type_id_fkey"
            columns: ["entity_type_id"]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_aliases: {
        Row: {
          alias: string
          alias_type: string
          entity_id: string
          id: string
          normalized_alias: string | null
        }
        Insert: {
          alias: string
          alias_type?: string
          entity_id: string
          id?: string
          normalized_alias?: string | null
        }
        Update: {
          alias?: string
          alias_type?: string
          entity_id?: string
          id?: string
          normalized_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_aliases_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_attribute_values: {
        Row: {
          attribute_definition_id: string
          boolean_value: boolean | null
          dataset_version_id: string
          date_value: string | null
          effective_at: string
          entity_id: string
          id: string
          json_value: Json | null
          number_value: number | null
          source_metadata: Json
          text_value: string | null
        }
        Insert: {
          attribute_definition_id: string
          boolean_value?: boolean | null
          dataset_version_id: string
          date_value?: string | null
          effective_at?: string
          entity_id: string
          id?: string
          json_value?: Json | null
          number_value?: number | null
          source_metadata?: Json
          text_value?: string | null
        }
        Update: {
          attribute_definition_id?: string
          boolean_value?: boolean | null
          dataset_version_id?: string
          date_value?: string | null
          effective_at?: string
          entity_id?: string
          id?: string
          json_value?: Json | null
          number_value?: number | null
          source_metadata?: Json
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_attribute_values_attribute_definition_id_fkey"
            columns: ["attribute_definition_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attribute_values_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attribute_values_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_external_ids: {
        Row: {
          entity_id: string
          external_id: string
          id: string
          metadata: Json
          source_slug: string
        }
        Insert: {
          entity_id: string
          external_id: string
          id?: string
          metadata?: Json
          source_slug: string
        }
        Update: {
          entity_id?: string
          external_id?: string
          id?: string
          metadata?: Json
          source_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_external_ids_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relationships: {
        Row: {
          created_at: string
          from_entity_id: string
          id: string
          metadata: Json
          relationship_type: string
          to_entity_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          from_entity_id: string
          id?: string
          metadata?: Json
          relationship_type: string
          to_entity_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          from_entity_id?: string
          id?: string
          metadata?: Json
          relationship_type?: string
          to_entity_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_from_entity_id_fkey"
            columns: ["from_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_to_entity_id_fkey"
            columns: ["to_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_types: {
        Row: {
          created_at: string
          description: string | null
          domain_id: string
          id: string
          plural_name: string
          presentation_schema: Json
          singular_name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain_id: string
          id?: string
          plural_name: string
          presentation_schema?: Json
          singular_name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain_id?: string
          id?: string
          plural_name?: string
          presentation_schema?: Json
          singular_name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_types_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
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
          id: string
          name: string
          owner_id: string
          slug: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          demographic_consent: boolean
          display_name: string | null
          handle: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          demographic_consent?: boolean
          display_name?: string | null
          handle?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          demographic_consent?: boolean
          display_name?: string | null
          handle?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_custom_metrics: {
        Row: {
          created_at: string
          entity_type_slug: string
          formula: Json
          id: string
          name: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          entity_type_slug: string
          formula: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          entity_type_slug?: string
          formula?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_cycles: {
        Row: {
          closes_at: string | null
          id: string
          opens_at: string | null
          season: number | null
          slug: string
          status: string
          template_id: string
          title: string
          week: number | null
        }
        Insert: {
          closes_at?: string | null
          id?: string
          opens_at?: string | null
          season?: number | null
          slug: string
          status?: string
          template_id: string
          title: string
          week?: number | null
        }
        Update: {
          closes_at?: string | null
          id?: string
          opens_at?: string | null
          season?: number | null
          slug?: string
          status?: string
          template_id?: string
          title?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_cycles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ranking_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_events: {
        Row: {
          actor_id: string | null
          client_revision: number | null
          created_at: string
          event_type: string
          id: number
          payload: Json
          ranking_id: string
        }
        Insert: {
          actor_id?: string | null
          client_revision?: number | null
          created_at?: string
          event_type: string
          id?: never
          payload?: Json
          ranking_id: string
        }
        Update: {
          actor_id?: string | null
          client_revision?: number | null
          created_at?: string
          event_type?: string
          id?: never
          payload?: Json
          ranking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_events_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_placements: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          metadata: Json
          position: number
          ranking_id: string
          rationale: string | null
          score: number | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          metadata?: Json
          position: number
          ranking_id: string
          rationale?: string | null
          score?: number | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          metadata?: Json
          position?: number
          ranking_id?: string
          rationale?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_placements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_placements_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_template_entities: {
        Row: {
          entity_id: string
          metadata: Json
          seed_order: number | null
          template_version_id: string
        }
        Insert: {
          entity_id: string
          metadata?: Json
          seed_order?: number | null
          template_version_id: string
        }
        Update: {
          entity_id?: string
          metadata?: Json
          seed_order?: number | null
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_template_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_template_entities_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "ranking_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_template_versions: {
        Row: {
          aggregate_eligible: boolean
          comparison_attribute_keys: string[]
          created_at: string
          default_length: number
          display_config: Json
          eligibility_query: Json
          entity_type_id: string
          exact_length: boolean
          id: string
          max_length: number
          min_length: number
          ranking_method: string
          template_id: string
          version: number
        }
        Insert: {
          aggregate_eligible?: boolean
          comparison_attribute_keys?: string[]
          created_at?: string
          default_length: number
          display_config?: Json
          eligibility_query?: Json
          entity_type_id: string
          exact_length?: boolean
          id?: string
          max_length: number
          min_length: number
          ranking_method?: string
          template_id: string
          version: number
        }
        Update: {
          aggregate_eligible?: boolean
          comparison_attribute_keys?: string[]
          created_at?: string
          default_length?: number
          display_config?: Json
          eligibility_query?: Json
          entity_type_id?: string
          exact_length?: boolean
          id?: string
          max_length?: number
          min_length?: number
          ranking_method?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_template_versions_entity_type_id_fkey"
            columns: ["entity_type_id"]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ranking_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          domain_id: string
          id: string
          slug: string
          status: string
          template_kind: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain_id: string
          id?: string
          slug: string
          status?: string
          template_kind?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain_id?: string
          id?: string
          slug?: string
          status?: string
          template_kind?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_templates_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          author_id: string | null
          created_at: string
          cycle_id: string | null
          dataset_version_id: string | null
          id: string
          note: string | null
          published_at: string | null
          revision: number
          status: string
          supersedes_ranking_id: string | null
          template_version_id: string
          title: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          cycle_id?: string | null
          dataset_version_id?: string | null
          id?: string
          note?: string | null
          published_at?: string | null
          revision?: number
          status?: string
          supersedes_ranking_id?: string | null
          template_version_id: string
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          cycle_id?: string | null
          dataset_version_id?: string | null
          id?: string
          note?: string | null
          published_at?: string | null
          revision?: number
          status?: string
          supersedes_ranking_id?: string | null
          template_version_id?: string
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "ranking_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_supersedes_ranking_id_fkey"
            columns: ["supersedes_ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "ranking_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          dataset_id: string
          dataset_version_id: string | null
          error_summary: string | null
          id: string
          metadata: Json
          request_count: number
          rows_received: number
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dataset_id: string
          dataset_version_id?: string | null
          error_summary?: string | null
          id?: string
          metadata?: Json
          request_count?: number
          rows_received?: number
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dataset_id?: string
          dataset_version_id?: string | null
          error_summary?: string | null
          id?: string
          metadata?: Json
          request_count?: number
          rows_received?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_jobs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_jobs_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cohort_values: {
        Row: {
          cohort_value_id: string
          consented_at: string
          source: string
          user_id: string
        }
        Insert: {
          cohort_value_id: string
          consented_at?: string
          source?: string
          user_id: string
        }
        Update: {
          cohort_value_id?: string
          consented_at?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cohort_values_cohort_value_id_fkey"
            columns: ["cohort_value_id"]
            isOneToOne: false
            referencedRelation: "cohort_values"
            referencedColumns: ["id"]
          },
        ]
      }
      user_entity_affiliations: {
        Row: {
          affiliation_type: string
          consented_at: string
          entity_id: string
          user_id: string
        }
        Insert: {
          affiliation_type: string
          consented_at?: string
          entity_id: string
          user_id: string
        }
        Update: {
          affiliation_type?: string
          consented_at?: string
          entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_entity_affiliations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_results: {
        Row: {
          actual_value: Json | null
          check_name: string
          created_at: string
          expected_value: Json | null
          id: string
          message: string | null
          source_job_id: string
          status: string
        }
        Insert: {
          actual_value?: Json | null
          check_name: string
          created_at?: string
          expected_value?: Json | null
          id?: string
          message?: string | null
          source_job_id: string
          status: string
        }
        Update: {
          actual_value?: Json | null
          check_name?: string
          created_at?: string
          expected_value?: Json | null
          id?: string
          message?: string | null
          source_job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_results_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "source_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_my_ranking_template: {
        Args: {
          p_description: string
          p_display_config: Json
          p_eligibility_query: Json
          p_entity_ids?: string[]
          p_entity_type_slug: string
          p_length: number
          p_ranking_method: string
          p_template_id: string
          p_title: string
          p_visibility: string
        }
        Returns: Json
      }
      get_rankable_catalog: {
        Args: { p_season: number }
        Returns: Json
      }
      get_rankable_dataset: {
        Args: { p_entity_type_slug: string; p_season: number }
        Returns: Json
      }
      get_cohort_consensus: {
        Args: {
          p_cycle_id: string
          p_filters: Json
          p_min_cohort?: number
          p_template_version_id: string
        }
        Returns: Json
      }
      get_ranking_affinity: {
        Args: {
          p_anchor_cycle_id: string
          p_anchor_entity_id: string
          p_anchor_max_position: number
          p_anchor_template_version_id: string
          p_compare_cycle_id: string
          p_compare_template_version_id: string
          p_filters: Json
          p_min_cohort?: number
        }
        Returns: Json
      }
      is_ranked_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      publish_my_ranking: { Args: { p_ranking_id: string }; Returns: Json }
      save_my_ranking_draft: {
        Args: {
          p_dataset_version_id: string
          p_entity_ids: string[]
          p_existing_ranking_id?: string
          p_note: string
          p_template_version_id: string
          p_title: string
          p_visibility: string
        }
        Returns: string
      }
      user_matches_ranked_cohort: {
        Args: { p_filters: Json; p_user_id: string }
        Returns: boolean
      }
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
